"use server";
import { auth } from "@clerk/nextjs/server";
import { InputType, ReturnType } from "./types";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/use-safe-action";
import { CreateCardSchema } from "./schema";
import { revalidatePath } from "next/cache";
import { CreateAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = auth();
  if (!userId || !orgId) {
    return { error: "Unauthorized" };
  }
  const { listId, title, boardId } = data;

  try {
    const board = await db.board.findUnique({ where: { id: boardId, orgId } });
    if (!board) {
      return {
        error: "Board not found!",
      };
    }

    const list = await db.list.findUnique({
      where: { id: listId, boardId, board: { orgId } },
    });
    if (!list) {
      return {
        error: "list not found!",
      };
    }

    const lastCard = await db.card.findFirst({
      where: { list: { boardId: board.id }, listId: list.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const lastOrder = lastCard ? lastCard.order + 1 : 1;

    const newCard = await db.card.create({
      data: {
        title,
        listId: list.id,
        order: lastOrder,
      },
    });

    await CreateAuditLog({
      action: ACTION.CREATE,
      entityId: newCard.id,
      entityTitle: newCard.title,
      entityType: ENTITY_TYPE.CARD,
    });

    revalidatePath(`/board/${board.id}`);
    return {
      data: newCard,
    };
  } catch (error) {
    console.log(`[Internall-error]`, error);
    return {
      error: "failed to create new card!",
    };
  }
};
export const createCard = createSafeAction(CreateCardSchema, handler);
