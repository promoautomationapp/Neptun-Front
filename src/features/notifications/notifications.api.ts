import { z } from "zod";
import { request } from "../../api/client";
export const workspaceNotificationSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum([
    "review_submitted",
    "mention",
    "review_comment",
    "review_reply",
  ]),
  campaignId: z.string().min(1),
  campaignName: z.string(),
  pageIndex: z.number().int().nonnegative().nullable(),
  commentId: z.string().nullable(),
  actorName: z.string(),
  actorEmail: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  message: z.string(),
});
export type WorkspaceNotification = z.infer<typeof workspaceNotificationSchema>;
const notificationsSchema = z.object({
  notifications: z.array(workspaceNotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationFeed = z.infer<typeof notificationsSchema>;
export type NotificationFilter = "all" | "unread";
export function getNotifications(
  filter: NotificationFilter,
  signal?: AbortSignal,
) {
  return request(`/api/notifications?filter=${filter}`, notificationsSchema, {
    signal,
  });
}
const readSchema = z.object({ read: z.literal(true) });
export function markNotificationRead(id: string) {
  return request(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    readSchema,
    { method: "POST" },
  );
}
export function markAllNotificationsRead() {
  return request("/api/notifications/read-all", readSchema, { method: "POST" });
}
