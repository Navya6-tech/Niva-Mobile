import { Router, type IRouter } from "express";
import twilio from "twilio";

const router: IRouter = Router();

router.post("/sos/send-sms", async (req, res) => {
  const { phones, message } = req.body as { phones?: unknown; message?: unknown };

  if (!Array.isArray(phones) || phones.length === 0 || typeof message !== "string") {
    res.status(400).json({ error: "phones (array) and message (string) are required" });
    return;
  }

  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_PHONE_NUMBER"];

  if (!sid || !token || !from) {
    req.log.error("Twilio env vars not configured");
    res.status(500).json({ error: "SMS service not configured" });
    return;
  }

  const client = twilio(sid, token);

  const results = await Promise.allSettled(
    (phones as string[]).map((to) =>
      client.messages.create({ body: message, from, to })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      req.log.error({ phone: (phones as string[])[i], err: r.reason }, "SMS send failed");
    }
  });

  res.json({ sent, failed, total: phones.length });
});

export default router;
