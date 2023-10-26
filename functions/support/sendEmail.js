const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

const supportEmail = process.env.SUPPORT_EMAIL;
const supportPassword = process.env.SUPPORT_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: supportEmail,
        pass: supportPassword
    }
});

exports.sendEmail = functions.https.onCall(async (data, context) => {
    const { userId, name, email, subject, text } = data;

    if (!userId || !name || !email || !subject || !text) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid data. Please provide userId, name, email, subject and text.');
    }

    const mailOptions = {
        from: supportEmail,
        to: 'korotaev.e.s@inbox.ru',
        subject: `[${email}]: ${subject}`,
        text: `
            subject: ${subject}
            name: ${name}
            email: ${email}
            userId: ${userId}
            text: ${text}
        `
    };

    try {
        await transporter.sendMail(mailOptions);

        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error(error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An error occurred while sending email.', error.message);
        }
    }
});
