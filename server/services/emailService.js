const nodemailer = require('nodemailer');

const TARGET_EMAIL = 'adityakaushik1200@gmail.com';

let activeOtp = null;
let otpExpiresAt = null;

// Generates a 6-digit numeric OTP and sends it to adityakaushik1200@gmail.
async function sendStartAuctionOtp() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    activeOtp = code;
    otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    console.log(`\n==================================================`);
    console.log(`✉ [EMAIL OTP SERVICE]`);
    console.log(`Target Email : ${TARGET_EMAIL}`);
    console.log(`OTP Code     : ${code}`);
    console.log(`Expires In   : 10 minutes`);
    console.log(`==================================================\n`);

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    let isSentViaSmtp = false;
    if (smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
            });

            await transporter.sendMail({
                from: `"JPL Auction Engine" <${smtpUser}>`,
                to: TARGET_EMAIL,
                subject: `🔒 JPL Auction Start Verification OTP: ${code}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; color: #1e293b;">
                        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <h2 style="color: #0f172a; margin-top: 0;">JPL Auction Start Request</h2>
                            <p>You have requested to start a new auction session and reset all franchise balances and player rosters.</p>
                            <p style="font-size: 14px; color: #64748b;">Your 6-digit verification code is:</p>
                            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1f6feb; text-align: center; padding: 15px; background: #eff6ff; border-radius: 8px; margin: 20px 0;">
                                ${code}
                            </div>
                            <p style="font-size: 12px; color: #94a3b8;">This code is valid for 10 minutes. If you did not initiate this request, please ignore this email.</p>
                        </div>
                    </div>
                `,
            });
            isSentViaSmtp = true;
            console.log(`✅ [EMAIL OTP] Successfully dispatched email to ${TARGET_EMAIL}`);
        } catch (err) {
            console.error(`⚠️ [EMAIL OTP] Failed to send email via SMTP (${err.message}). Code ${code} logged to console.`);
        }
    } else {
        console.log(`ℹ️ [EMAIL OTP] SMTP credentials (SMTP_USER / SMTP_PASS) not configured in .env. OTP logged above for verification.`);
    }

    return { success: true, email: TARGET_EMAIL, isSentViaSmtp, devOtp: !isSentViaSmtp ? code : undefined };
}

// Verifies the submitted OTP against the active OTP
function verifyStartAuctionOtp(inputCode) {
    if (!activeOtp || !otpExpiresAt) {
        return { valid: false, message: 'No active OTP found. Please click Start Auction again.' };
    }
    if (Date.now() > otpExpiresAt) {
        activeOtp = null;
        otpExpiresAt = null;
        return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
    }
    if (String(inputCode).trim() !== String(activeOtp).trim()) {
        return { valid: false, message: 'Invalid OTP code. Please check your email and try again.' };
    }

    // Clear OTP upon successful verification
    activeOtp = null;
    otpExpiresAt = null;
    return { valid: true };
}

module.exports = {
    sendStartAuctionOtp,
    verifyStartAuctionOtp,
    TARGET_EMAIL,
};
