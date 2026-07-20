/* =========================================================
   FORGOT PASSWORD CONTROLLER (script.js)
   KvaultX Password Reset Handler
========================================================= */

const AUTH_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api/auth"
    : `${window.location.origin}/api/auth`;

document.addEventListener("DOMContentLoaded", () => {
    const forgotMobile = document.querySelector("#forgotMobile");
    const sendOtpBtn = document.querySelector("#sendOtpBtn");
    const resendOtpBtn = document.querySelector("#resendOtpBtn");
    const otpInput = document.querySelector("#otpInput");
    const newPassword = document.querySelector("#newPassword");
    const resetPassBtn = document.querySelector("#resetPassBtn");

    if (sendOtpBtn && forgotMobile) {
        sendOtpBtn.addEventListener("click", async () => {
            const email = forgotMobile.value.trim();
            if (!email) {
                return alert("Please enter your registered email address.");
            }

            try {
                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = "Sending...";

                const response = await fetch(`${AUTH_URL}/forgot-password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    alert(data.message || "Failed to send OTP.");
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = "⚡ Send OTP";
                    return;
                }

                let msg = `📧 OTP verification code sent to ${email}!`;
                if (data.demoOtp) {
                    msg += `\n\n🔑 Verification Code: ${data.demoOtp}`;
                }
                alert(msg);
                sendOtpBtn.textContent = "OTP Sent ✓";
            } catch (error) {
                console.error(error);
                alert("Connection error. Is the server running?");
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "⚡ Send OTP";
            }
        });
    }

    if (resendOtpBtn && forgotMobile) {
        resendOtpBtn.addEventListener("click", async () => {
            const email = forgotMobile.value.trim();
            if (!email) {
                return alert("Please enter your registered email address.");
            }

            try {
                resendOtpBtn.disabled = true;
                resendOtpBtn.textContent = "Resending...";

                const response = await fetch(`${AUTH_URL}/forgot-password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    alert(data.message || "Failed to resend OTP.");
                } else {
                    let msg = `📧 OTP verification code resent to ${email}!`;
                    if (data.demoOtp) {
                        msg += `\n\n🔑 Verification Code: ${data.demoOtp}`;
                    }
                    alert(msg);
                }
            } catch (error) {
                console.error(error);
                alert("Connection error.");
            } finally {
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = "🔄 Resend";
            }
        });
    }

    if (resetPassBtn && forgotMobile && otpInput && newPassword) {
        resetPassBtn.addEventListener("click", async () => {
            const email = forgotMobile.value.trim();
            const otp = otpInput.value.trim();
            const password = newPassword.value.trim();

            if (!email || !otp || !password) {
                return alert("Please fill in email, OTP, and your new chosen password.");
            }

            if (password.length < 6) {
                return alert("New password must be at least 6 characters long.");
            }

            try {
                resetPassBtn.disabled = true;
                resetPassBtn.textContent = "Resetting...";

                const response = await fetch(`${AUTH_URL}/reset-password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        otp,
                        newPassword: password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.message || "Failed to reset password.");
                    resetPassBtn.disabled = false;
                    resetPassBtn.textContent = "Reset Password";
                } else {
                    alert("🔑 Password updated successfully! You can now log in with your new chosen password.");
                    window.location.href = "pages/login.html";
                }
            } catch (error) {
                console.error(error);
                alert("Connection error while resetting password.");
                resetPassBtn.disabled = false;
                resetPassBtn.textContent = "Reset Password";
            }
        });
    }
});
