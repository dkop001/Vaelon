import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  // Optional secret key check to authorize the cron execution
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: "DATABASE_URL is missing" });
  }

  try {
    const sql = neon(databaseUrl);

    // 1. Prune raw messages (chat_messages) older than 30 days
    const prunedMessages = await sql(
      `DELETE FROM chat_messages WHERE created_at < now() - INTERVAL '30 days'`
    );

    // 2. Prune chat_memory entries that have expired (updated_at older than 90 days of inactivity)
    const prunedMemory = await sql(
      `DELETE FROM chat_memory WHERE updated_at < now() - INTERVAL '90 days'`
    );

    return res.status(200).json({
      success: true,
      message: "Database cleanup completed successfully",
      prunedMessages: prunedMessages.length,
      prunedMemory: prunedMemory.length,
    });
  } catch (error) {
    console.error("Cleanup CRON error:", error);
    return res.status(500).json({ error: "Failed to perform database cleanup" });
  }
}
