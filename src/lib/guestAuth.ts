import { prisma } from "@/lib/prisma";

// Resolves a guest link token to its member (or null). Guests can only touch
// tasks where they are the owner — every guest route re-checks that.
export async function getMemberByToken(token: string) {
  if (!token || token.length < 16) return null;
  return prisma.taskMember.findUnique({
    where: { accessToken: token },
    include: { project: { select: { id: true, name: true, domain: true } } },
  });
}

export async function getOwnedTask(memberId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, ownerId: memberId } });
}
