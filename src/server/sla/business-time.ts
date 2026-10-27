import { SLA_RULES, type Priority } from "@/lib/domain";

const TIME_ZONE = "America/Sao_Paulo";
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
const SAO_PAULO_OFFSET_HOURS = 3;

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function wallClock(date: Date): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
    weekday: WEEKDAYS[part(parts, "weekday")] ?? 0,
  };
}

function fromWall(clock: WallClock) {
  return new Date(
    Date.UTC(
      clock.year,
      clock.month - 1,
      clock.day,
      clock.hour + SAO_PAULO_OFFSET_HOURS,
      clock.minute,
      0,
      0,
    ),
  );
}

function isWeekend(clock: WallClock) {
  return clock.weekday === 0 || clock.weekday === 6;
}

function nextDay(clock: WallClock): WallClock {
  const moved = wallClock(new Date(fromWall(clock).getTime() + 24 * 60 * 60 * 1000));
  return { ...moved, hour: clock.hour, minute: clock.minute };
}

function nextBusinessMorning(clock: WallClock): WallClock {
  let cursor = nextDay(clock);
  while (isWeekend(cursor)) cursor = nextDay(cursor);
  return { ...cursor, hour: OPEN_HOUR, minute: 0 };
}

export function alignToBusinessHours(date: Date) {
  const clock = wallClock(date);
  if (isWeekend(clock) || clock.hour >= CLOSE_HOUR) return fromWall(nextBusinessMorning(clock));
  if (clock.hour < OPEN_HOUR) return fromWall({ ...clock, hour: OPEN_HOUR, minute: 0 });
  return date;
}

export function addBusinessHours(start: Date, hours: number) {
  let cursor = wallClock(alignToBusinessHours(start));
  let remaining = Math.round(hours * 60);

  while (remaining > 0) {
    const available = (CLOSE_HOUR - cursor.hour) * 60 - cursor.minute;
    if (remaining <= available) {
      const minute = cursor.minute + remaining;
      return fromWall({
        ...cursor,
        hour: cursor.hour + Math.floor(minute / 60),
        minute: minute % 60,
      });
    }
    remaining -= available;
    cursor = nextBusinessMorning(cursor);
  }

  return fromWall(cursor);
}

export function addBusinessDays(start: Date, days: number) {
  let cursor = wallClock(alignToBusinessHours(start));
  let left = days;
  while (left > 0) {
    cursor = nextDay(cursor);
    if (!isWeekend(cursor)) left -= 1;
  }
  if (cursor.hour < OPEN_HOUR) cursor = { ...cursor, hour: OPEN_HOUR, minute: 0 };
  if (cursor.hour >= CLOSE_HOUR) cursor = nextBusinessMorning(cursor);
  return fromWall(cursor);
}

export function deadlineFor(priority: Priority, from: Date) {
  const rule = SLA_RULES[priority];
  if (rule.unit === "clock_hours") return new Date(from.getTime() + rule.amount * 60 * 60 * 1000);
  if (rule.unit === "business_hours") return addBusinessHours(from, rule.amount);
  return addBusinessDays(from, rule.amount);
}

export function isOverdue(dueAt: string | Date, now = new Date()) {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return now.getTime() > due.getTime();
}

export function formatDeadline(date: Date) {
  const clock = wallClock(date);
  const hour = String(clock.hour).padStart(2, "0");
  const minute = String(clock.minute).padStart(2, "0");
  return `resposta até ${hour}:${minute}`;
}

export function formatRelative(iso: string, now = new Date()) {
  const deltaMs = now.getTime() - new Date(iso).getTime();
  const days = Math.round(deltaMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}
