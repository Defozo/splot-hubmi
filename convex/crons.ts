import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("deliver outbox", { minutes: 1 }, internal.jobs.deliverOutbox, {});
crons.interval("resource validity and calls", { hours: 1 }, internal.jobs.maintenance, {});
crons.daily("review watched needs", { hourUTC: 4, minuteUTC: 0 }, internal.matching.periodicReview, {});
crons.daily("expire transient matching data", { hourUTC: 3, minuteUTC: 0 }, internal.search.purgeTransient, {});
export default crons;
