import { onCall, HttpsError } from 'firebase-functions/v2/https';
import nodemailer from 'nodemailer';


const supportEmail = process.env.SUPPORT_EMAIL;
const supportPassword = process.env.SUPPORT_PASSWORD;

const transporter = nodemailer.createTransport({
    host: 'smtpout.secureserver.net',
    secure: false,
    port: 587,
    auth: {
        user: supportEmail,
        pass: supportPassword,
    },
});

export const sendEmail_v2 = onCall(
    { enforceAppCheck: false },
    async (request) => {
    const { userId, name, email, subject, text } = request.data;

    if (!userId || !name || !email || !subject || !text) {
        throw new HttpsError('invalid-argument', 'Invalid data. Please provide userId, name, email, subject, and text.');
    }

    const mailOptions = {
        from: supportEmail,
        to: supportEmail,
        subject: `[${email}]: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\nUserId: ${userId}\nSubject: ${subject}\nMessage:\n${text}`,
    };

    try {
        await transporter.sendMail(mailOptions);

        return { message: 'Email sent successfully' };
    } catch (error) {
        console.error(error);

        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError('internal', 'An error occurred while sending email.', error.message);
        }
    }
});
