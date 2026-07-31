/**
 * CherryPhone client — dialer UI + Twilio Voice SDK + server-side config.
 *
 * Config is stored server-side in D1 (encrypted). The Worker handles
 * auth via Cloudflare Access and serves the config/token APIs.
 */

// ── DOM refs ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const numberDisplay = $("numberDisplay");
const callStatus = $("callStatus");
const dialpad = $("dialpad");
const callBtn = $("callBtn");
const backspaceBtn = $("backspaceBtn");
const navBar = $("navBar");
const settingsStatus = $("settingsStatus");
const saveBtn = $("saveBtn");
const clearBtn = $("clearBtn");

// ── State ────────────────────────────────────────────────────────────
let dialedNumber = "";
let device = null;
let activeCall = null;
let callStartTime = null;
let durationInterval = null;

// ── Dial pad layout ─────────────────────────────────────────────────
const DIAL_KEYS = [
	["1", "2", "3"],
	["4", "5", "6"],
	["7", "8", "9"],
	["*", "0", "#"],
];

// ── Navigation ───────────────────────────────────────────────────────
function switchView(view) {
	document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
	document.getElementById(`view-${view}`)?.classList.add("active");
	document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
	document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add("active");
}

navBar.addEventListener("click", (e) => {
	const target = e.target.closest(".nav-item");
	if (!target) return;
	switchView(target.getAttribute("data-view"));
});

// ── Dial pad ─────────────────────────────────────────────────────────
function buildDialPad() {
	for (const row of DIAL_KEYS) {
		const rowEl = document.createElement("div");
		rowEl.className = "dialpad-row";
		for (const key of row) {
			const btn = document.createElement("button");
			btn.className = "dialpad-key";
			btn.textContent = key;
			btn.dataset.key = key;
			btn.addEventListener("click", () => appendDigit(key));
			rowEl.appendChild(btn);
		}
		dialpad.appendChild(rowEl);
	}
}

function appendDigit(key) {
	if (dialedNumber.length >= 20) return;
	dialedNumber += key;
	updateDisplay();
}

function updateDisplay() {
	numberDisplay.textContent = dialedNumber || "";
	callStatus.textContent = dialedNumber ? "" : "Enter a number";
	callStatus.style.color = "#888899";
}

// ── Backspace ───────────────────────────────────────────────────────
backspaceBtn.addEventListener("click", () => {
	dialedNumber = dialedNumber.slice(0, -1);
	updateDisplay();
});

let longPressTimer = null;
backspaceBtn.addEventListener("pointerdown", () => {
	longPressTimer = setTimeout(() => {
		dialedNumber = "";
		updateDisplay();
		longPressTimer = null;
	}, 500);
});
backspaceBtn.addEventListener("pointerup", () => {
	if (longPressTimer) {
		clearTimeout(longPressTimer);
		longPressTimer = null;
	}
});
backspaceBtn.addEventListener("pointerleave", () => {
	if (longPressTimer) {
		clearTimeout(longPressTimer);
		longPressTimer = null;
	}
});

// ── API helpers ──────────────────────────────────────────────────────
async function apiFetch(path, options) {
	try {
		const res = await fetch(path, {
			headers: { "Content-Type": "application/json" },
			...options,
		});
		return await res.json();
	} catch (e) {
		return { ok: false, error: `Network error: ${e}` };
	}
}

async function getConfig() {
	const res = await apiFetch("/api/config");
	if (res.ok && res.data) return res.data;
	return null;
}

async function saveConfigToServer(config) {
	const res = await apiFetch("/api/config", {
		method: "POST",
		body: JSON.stringify(config),
	});
	return res.ok;
}

async function getToken() {
	const res = await apiFetch("/api/token", {
		method: "POST",
	});
	if (res.ok && res.data) return res.data;
	return null;
}

async function logCall(entry) {
	await apiFetch("/api/logs", {
		method: "POST",
		body: JSON.stringify(entry),
	});
}

// ── Twilio Device setup (Voice JS SDK 2.x) ──────────────────────────
//
// 2.x moves per-call events onto the Call object returned by
// device.connect() instead of a device-level "connect" event, and
// requires an explicit device.register() call before the device can
// receive incoming calls at all.
async function setupDevice() {
	if (device) {
		device.destroy();
		device = null;
	}

	const tokenData = await getToken();
	if (!tokenData) {
		showStatus("Configure Twilio in Settings first", "#EF5350");
		return;
	}

	device = new Twilio.Device(tokenData.token, {
		codecPreferences: ["opus", "pcmu"],
	});

	device.on("registered", () => {
		console.log("Twilio device registered");
	});

	device.on("error", (error) => {
		console.error("Twilio device error:", error);
		showStatus(`Device error: ${error.message}`, "#EF5350");
	});

	// The Access Token is short-lived (see TOKEN_TTL server-side). The SDK
	// fires this shortly before expiry so the device can be refreshed
	// in-place — without it, the device silently stops working an hour in.
	device.on("tokenWillExpire", async () => {
		try {
			const tokenData = await getToken();
			if (!tokenData || !device) {
				showStatus("Couldn't refresh call credentials — reopen the app if calls stop working", "#EF5350");
				return;
			}
			device.updateToken(tokenData.token);
			console.log("Twilio Access Token refreshed");
		} catch (e) {
			console.error("Token refresh failed:", e);
			showStatus("Couldn't refresh call credentials — reopen the app if calls stop working", "#EF5350");
		}
	});

	device.on("incoming", (call) => {
		const fromNumber = call.parameters.From || "Unknown";
		console.log("Incoming call from", fromNumber);
		logCall({ toNumber: fromNumber, status: "ringing", direction: "inbound", callSid: call.parameters.CallSid });
		showIncomingCallOverlay(call, fromNumber);

		// Fires if the caller hangs up before the call is accepted/rejected.
		call.on("cancel", () => {
			hideIncomingCallOverlay();
			showStatus("Missed call", "#888899");
			logCall({ toNumber: fromNumber, status: "missed", direction: "inbound", callSid: call.parameters.CallSid });
		});
	});

	try {
		await device.register();
	} catch (e) {
		console.error("Twilio device registration failed:", e);
		showStatus(`Registration failed: ${e.message || e}`, "#EF5350");
	}
}

// ── Call button ──────────────────────────────────────────────────────
callBtn.addEventListener("click", async () => {
	if (activeCall) {
		activeCall.disconnect();
		activeCall = null;
		callBtn.classList.remove("call-active");
		callBtn.innerHTML = phoneIconSvg();
		return;
	}

	if (!dialedNumber) {
		showStatus("Enter a number to call", "#EF5350");
		return;
	}

	try {
		showStatus("Connecting...", "#7C4DFF");

		if (!device) {
			await setupDevice();
		}

		if (!device) {
			showStatus("Device not ready. Check Settings.", "#EF5350");
			return;
		}

		const call = await device.connect({ params: { To: dialedNumber } });
		activeCall = call;

		// 2.x: connect-related events live on the returned Call, not on
		// the Device. "accept" replaces the old device-level "connect".
		attachCallHandlers(call, dialedNumber, "outbound");

		callBtn.classList.add("call-active");
		callBtn.innerHTML = checkIconSvg();
		showStatus(`Calling ${dialedNumber}...`, "#4CAF50");
		logCall({ toNumber: dialedNumber, status: "initiated" });
	} catch (e) {
		showStatus(`Failed: ${e}`, "#EF5350");
	}
});

// ── SVG icons ────────────────────────────────────────────────────────
function phoneIconSvg() {
	return `<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
		<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
	</svg>`;
}

function checkIconSvg() {
	return `<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
	</svg>`;
}

// ── Call event wiring (shared by outbound and inbound calls) ────────
//
// 2.x puts connect-related events on the Call object itself, so the
// same handlers cover both device.connect() (outbound) and
// call.accept() (inbound) — only the log entries' direction differs.
function attachCallHandlers(call, remoteNumber, direction) {
	call.on("accept", () => {
		showCallInProgress(remoteNumber);
		logCall({
			toNumber: remoteNumber,
			status: "connected",
			direction,
			callSid: call.parameters?.CallSid,
			startedAt: new Date().toISOString(),
		});
	});

	call.on("disconnect", () => {
		const endedAt = new Date().toISOString();
		const duration = callStartTime
			? Math.floor((Date.now() - callStartTime) / 1000)
			: undefined;
		activeCall = null;
		hideCallInProgress();
		showStatus("Call ended", "#888899");
		logCall({
			toNumber: remoteNumber,
			status: "completed",
			direction,
			durationSeconds: duration,
			callSid: call.parameters?.CallSid,
			endedAt,
		});
	});

	call.on("error", (error) => {
		activeCall = null;
		hideCallInProgress();
		hideIncomingCallOverlay();
		showStatus(`Call error: ${error.message}`, "#EF5350");
		logCall({ toNumber: remoteNumber, status: "failed", direction, callSid: call.parameters?.CallSid });
	});
}

// ── Incoming-call overlay ────────────────────────────────────────────
let incomingOverlay = null;

function showIncomingCallOverlay(call, fromNumber) {
	incomingOverlay = document.createElement("div");
	incomingOverlay.className = "call-overlay incoming-overlay";
	// fromNumber comes from call.parameters.From — caller ID set by the
	// remote party over the network, not by our own code. Caller ID is
	// trivially spoofable, so it must never be interpolated into HTML;
	// the markup below is static, and the number is assigned via
	// textContent (never innerHTML) just after.
	incomingOverlay.innerHTML = `
		<div class="status">Incoming call</div>
		<div class="number"></div>
		<div class="incoming-actions">
			<button class="incoming-btn reject-btn" id="rejectCallBtn" aria-label="Reject">
				${phoneIconSvg()}
			</button>
			<button class="incoming-btn accept-btn" id="acceptCallBtn" aria-label="Accept">
				${phoneIconSvg()}
			</button>
		</div>
	`;
	incomingOverlay.querySelector(".number").textContent = fromNumber;
	document.body.appendChild(incomingOverlay);

	$("acceptCallBtn").addEventListener("click", () => {
		hideIncomingCallOverlay();
		activeCall = call;
		attachCallHandlers(call, fromNumber, "inbound");
		call.accept();
	});

	$("rejectCallBtn").addEventListener("click", () => {
		call.reject();
		logCall({ toNumber: fromNumber, status: "rejected", direction: "inbound", callSid: call.parameters?.CallSid });
		hideIncomingCallOverlay();
	});
}

function hideIncomingCallOverlay() {
	if (incomingOverlay) {
		incomingOverlay.remove();
		incomingOverlay = null;
	}
}

// ── Call in-progress overlay ─────────────────────────────────────────
let callOverlay = null;

function showCallInProgress(number) {
	callOverlay = document.createElement("div");
	callOverlay.className = "call-overlay";
	// `number` is the dialed digits for an outbound call (safe — built only
	// from the dialpad's own 0-9/*/# keys) but the remote party's caller ID
	// for an inbound call, which is attacker-controlled and spoofable. Since
	// this function serves both paths, treat `number` as untrusted here too:
	// static markup only, value assigned via textContent below.
	callOverlay.innerHTML = `
		<div class="number"></div>
		<div class="status">Connected</div>
		<div class="duration" id="callDuration">00:00</div>
		<button class="end-call-btn" id="endCallOverlay">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
				<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
			</svg>
		</button>
	`;
	callOverlay.querySelector(".number").textContent = number;
	document.body.appendChild(callOverlay);

	callStartTime = Date.now();
	durationInterval = setInterval(updateDuration, 1000);

	$("endCallOverlay").addEventListener("click", () => {
		if (activeCall) activeCall.disconnect();
	});
}

function hideCallInProgress() {
	if (callOverlay) {
		callOverlay.remove();
		callOverlay = null;
	}
	if (durationInterval) {
		clearInterval(durationInterval);
		durationInterval = null;
	}
	callStartTime = null;
	callBtn.classList.remove("call-active");
	callBtn.innerHTML = phoneIconSvg();
}

function updateDuration() {
	const el = $("callDuration");
	if (!el || !callStartTime) return;
	const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
	const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
	const secs = String(elapsed % 60).padStart(2, "0");
	el.textContent = `${mins}:${secs}`;
}

// ── Status helper ────────────────────────────────────────────────────
function showStatus(msg, color) {
	callStatus.textContent = msg;
	callStatus.style.color = color;
}

// ── Settings ─────────────────────────────────────────────────────────
async function populateSettingsForm() {
	const config = await getConfig();
	if (config) {
		$("accountSid").value = config.accountSid;
		$("apiKeySid").value = config.apiKeySid;
		$("twimlAppSid").value = config.twimlAppSid;
		$("twilioNumber").value = config.twilioNumber;
		$("identity").value = config.identity;
		$("apiKeySecret").value = config.hasApiKeySecret ? "••••••••" : "";
		$("authToken").value = config.hasAuthToken ? "••••••••" : "";
	}
}

// ── Settings event handlers ─────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
	const accountSid = $("accountSid").value.trim();
	const apiKeySid = $("apiKeySid").value.trim();
	const apiKeySecret = $("apiKeySecret").value.trim();
	const twimlAppSid = $("twimlAppSid").value.trim();
	const authToken = $("authToken").value.trim();
	const twilioNumber = $("twilioNumber").value.trim();
	const identity = $("identity").value.trim() || "CherryPhone User";

	if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid || !authToken || !twilioNumber) {
		settingsStatus.textContent = "Please fill in all required fields";
		settingsStatus.style.color = "#EF5350";
		return;
	}

	const ok = await saveConfigToServer({
		accountSid,
		apiKeySid,
		apiKeySecret,
		twimlAppSid,
		authToken,
		twilioNumber,
		identity,
	});

	if (ok) {
		settingsStatus.textContent = "✓ Settings saved to server";
		settingsStatus.style.color = "#4CAF50";
		device = null;
		await setupDevice();
	} else {
		settingsStatus.textContent = "✗ Failed to save settings";
		settingsStatus.style.color = "#EF5350";
	}
});

// Clearing credentials is destructive and irreversible, so it needs a
// confirmation step. window.confirm()/alert() are avoided deliberately —
// they block the page and break automated testing of this app — so this
// is an inline two-step confirm: the first tap arms it, a second tap
// within the window confirms, and it auto-disarms if left alone.
const CLEAR_CONFIRM_TIMEOUT_MS = 4000;
let clearConfirmTimer = null;

function resetClearButton() {
	if (clearConfirmTimer) {
		clearTimeout(clearConfirmTimer);
		clearConfirmTimer = null;
	}
	clearBtn.textContent = "Clear All";
	clearBtn.classList.remove("confirm");
}

clearBtn.addEventListener("click", async () => {
	if (!clearConfirmTimer) {
		clearBtn.textContent = "Really clear? Tap again to confirm";
		clearBtn.classList.add("confirm");
		clearConfirmTimer = setTimeout(resetClearButton, CLEAR_CONFIRM_TIMEOUT_MS);
		return;
	}

	resetClearButton();
	clearBtn.disabled = true;

	const res = await apiFetch("/api/config", { method: "DELETE" });

	if (res.ok) {
		$("accountSid").value = "";
		$("apiKeySid").value = "";
		$("apiKeySecret").value = "";
		$("twimlAppSid").value = "";
		$("authToken").value = "";
		$("twilioNumber").value = "";
		$("identity").value = "";
		settingsStatus.textContent = "All settings cleared";
		settingsStatus.style.color = "#888899";
		if (device) {
			device.destroy();
			device = null;
		}
	} else {
		settingsStatus.textContent = `✗ Failed to clear settings: ${res.error || "unknown error"}`;
		settingsStatus.style.color = "#EF5350";
	}

	clearBtn.disabled = false;
});

// ── Secret field visibility toggles ─────────────────────────────────
$("toggleApiKeySecret").addEventListener("click", () => {
	const input = $("apiKeySecret");
	input.type = input.type === "password" ? "text" : "password";
});
$("toggleAuthToken").addEventListener("click", () => {
	const input = $("authToken");
	input.type = input.type === "password" ? "text" : "password";
});

// ── Init ────────────────────────────────────────────────────────────
buildDialPad();
populateSettingsForm();

// Auto-setup device if a full config exists
(async () => {
	const config = await getConfig();
	if (config && config.hasApiKeySecret && config.hasAuthToken) {
		setupDevice();
	}
})();
