import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";

// POST - Check and perform scheduled transfers from tomorrow to today
export async function POST() {
  try {
    const now = new Date();

    // Find tomorrow tasks that are due for transfer
    const tomorrowTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.type, "tomorrow"),
          eq(tasks.transferred, false),
          lte(tasks.scheduledTransferAt, now)
        )
      );

    if (tomorrowTasks.length === 0) {
      return NextResponse.json({ transferred: false, message: "No tasks due for transfer" });
    }

    const tomorrowTask = tomorrowTasks[0];

    if (!tomorrowTask.content.trim()) {
      // Nothing to transfer, just reset
      await db
        .update(tasks)
        .set({ transferred: true, updatedAt: now })
        .where(eq(tasks.type, "tomorrow"));
      return NextResponse.json({ transferred: false, message: "Tomorrow task was empty" });
    }

    // Get current today tasks
    const todayTasks = await db.select().from(tasks).where(eq(tasks.type, "today"));

    const todayContent = todayTasks.length > 0 ? todayTasks[0].content : "";
    const newTodayContent = todayContent.trim()
      ? `${todayContent.trim()}\n${tomorrowTask.content.trim()}`
      : tomorrowTask.content.trim();

    // Update today task
    if (todayTasks.length > 0) {
      await db
        .update(tasks)
        .set({ content: newTodayContent, updatedAt: now })
        .where(eq(tasks.type, "today"));
    } else {
      await db.insert(tasks).values({
        type: "today",
        content: newTodayContent,
        updatedAt: now,
      });
    }

    // Mark tomorrow as transferred and clear it
    await db
      .update(tasks)
      .set({
        content: "",
        transferred: true,
        scheduledTransferAt: null,
        updatedAt: now,
      })
      .where(eq(tasks.type, "tomorrow"));

    return NextResponse.json({
      transferred: true,
      message: "Tomorrow tasks transferred to today successfully",
      transferredContent: tomorrowTask.content,
    });
  } catch (error) {
    console.error("POST /api/tasks/transfer error:", error);
    return NextResponse.json({ error: "Failed to transfer tasks" }, { status: 500 });
  }
}

// GET - Check transfer status
export async function GET() {
  try {
    const now = new Date();
    const tomorrowTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.type, "tomorrow"),
          eq(tasks.transferred, false),
          lte(tasks.scheduledTransferAt, now)
        )
      );

    return NextResponse.json({
      hasPendingTransfer: tomorrowTasks.length > 0,
      task: tomorrowTasks[0] || null,
    });
  } catch (error) {
    console.error("GET /api/tasks/transfer error:", error);
    return NextResponse.json({ error: "Failed to check transfer status" }, { status: 500 });
  }
}
