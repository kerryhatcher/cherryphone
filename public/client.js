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

// ── Twilio Device setup ──────────────────────────────────────────────
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

	device.on("ready", () => {
		console.log("Twilio device ready");
	});

	device.on("error", (error) => {
		console.error("Twilio device error:", error);
		showStatus(`Device error: ${error.message}`, "#EF5350");
	});

	device.on("connect", (call) => {
		activeCall = call;
		showCallInProgress(dialedNumber);
		logCall({ toNumber: dialedNumber, status: "connected", startedAt: new Date().toISOString() });

		call.on("disconnect", () => {
			const endedAt = new Date().toISOString();
			const duration = callStartTime
				? Math.floor((Date.now() - callStartTime) / 1000)
				: undefined;
			activeCall = null;
			hideCallInProgress();
			showStatus("Call ended", "#888899");
			logCall({ toNumber: dialedNumber, status: "completed", durationSeconds: duration, endedAt });
		});

		call.on("error", (error) => {
			activeCall = null;
			hideCallInProgress();
			showStatus(`Call error: ${error.message}`, "#EF5350");
			logCall({ toNumber: dialedNumber, status: "failed" });
		});
	});

	device.on("disconnect", () => {
		activeCall = null;
		hideCallInProgress();
	});
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

		const params = { To: dialedNumber };
		await device.connect({ params });

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

// ── Call in-progress overlay ─────────────────────────────────────────
let callOverlay = null;

function showCallInProgress(number) {
	callOverlay = document.createElement("div");
	callOverlay.className = "call-overlay";
	callOverlay.innerHTML = `
		<div class="number">${number}</div>
		<div class="status">Connected</div>
		<div class="duration" id="callDuration">00:00</div>
		<button class="end-call-btn" id="endCallOverlay">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="white">
				<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
			</svg>
		</button>
	`;
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
		$("twilioNumber").value = config.twilioNumber;
		$("identity").value = config.identity;
		$("authToken").value = config.hasAuthToken ? "••••••••" : "";
	}
}

// ── Settings event handlers ─────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
	const accountSid = $("accountSid").value.trim();
	const authToken = $("authToken").value.trim();
	const twilioNumber = $("twilioNumber").value.trim();
	const identity = $("identity").value.trim() || "CherryPhone User";

	if (!accountSid || !authToken || !twilioNumber) {
		settingsStatus.textContent = "Please fill in all required fields";
		settingsStatus.style.color = "#EF5350";
		return;
	}

	const ok = await saveConfigToServer({ accountSid, authToken, twilioNumber, identity });

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

clearBtn.addEventListener("click", async () => {
	await saveConfigToServer({
		accountSid: "",
		authToken: "",
		twilioNumber: "",
		identity: "",
	});
	$("accountSid").value = "";
	$("authToken").value = "";
	$("twilioNumber").value = "";
	$("identity").value = "";
	settingsStatus.textContent = "All settings cleared";
	settingsStatus.style.color = "#888899";
	if (device) {
		device.destroy();
		device = null;
	}
});

// ── Auth token visibility toggle ────────────────────────────────────
$("toggleAuthToken").addEventListener("click", () => {
	const input = $("authToken");
	input.type = input.type === "password" ? "text" : "password";
});

// ── Init ────────────────────────────────────────────────────────────
buildDialPad();
populateSettingsForm();

// Auto-setup device if config exists
(async () => {
	const config = await getConfig();
	if (config && config.hasAuthToken) {
		setupDevice();
	}
})();
