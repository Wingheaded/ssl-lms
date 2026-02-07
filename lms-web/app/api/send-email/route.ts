import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const { to, bcc, subject, html } = await request.json();

        if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
            throw new Error('Missing SMTP_EMAIL or SMTP_PASSWORD environment variables');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: false // Helps in some local dev environments with self-signed certs issues
            }
        });

        const mailOptions = {
            from: `"Skin Self Love Academy" <${process.env.SMTP_EMAIL}>`,
            to,
            bcc,
            subject,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: %s", info.messageId);

        return NextResponse.json({ success: true, message: 'Email sent successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error sending email:', error);
        // @ts-ignore
        return NextResponse.json({ success: false, message: error.message || 'Failed to send email' }, { status: 500 });
    }
}
