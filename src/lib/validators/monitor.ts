import { z } from "zod";

export const createAnnouncementSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, "Announcement message must be at least 2 characters")
    .max(1000, "Announcement message is too long"),
});
