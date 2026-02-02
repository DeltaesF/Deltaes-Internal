import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

interface MailOption {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: MailOption) => {
  try {
    const mailOptions = {
      from: `"델타이에스 ERP 알림" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("❌ Email send failed:", error);
    return false;
  }
};
