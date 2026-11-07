import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, asc, or, and } from 'drizzle-orm';
import { navCards, navGroups } from '@server/database/sqlite-schema';
import { SQLITE_DATABASE } from '@server/database/database.service';
import type {
  NavCard,
  NavGroup,
  NavGroupWithCards,
  NavDataResponse,
} from '@shared/api.interface';
import type {
  CreateCardDto,
  CreateGroupDto,
  UpdateCardDto,
  UpdateGroupDto,
  ReorderCardsDto,
} from './dto';

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

@Injectable()
export class NavService {
  private readonly logger = new Logger(NavService.name);

  constructor(
    @Inject(SQLITE_DATABASE)
    private readonly db: BetterSQLite3Database<typeof import('@server/database/sqlite-schema')>,
  ) {}

  // ============ Groups ============

  async getGroups(userId: string, isPublic: boolean = true): Promise<NavGroup[]> {
    const groups = this.db
      .select()
      .from(navGroups)
      .where(
        isPublic
          ? eq(navGroups.isPublic, true)
          : or(eq(navGroups.userId, userId), eq(navGroups.isPublic, true)),
      )
      .orderBy(asc(navGroups.sortOrder))
      .all();
    return groups.map((g) => this.toNavGroup(g));
  }

  async createGroup(dto: CreateGroupDto, userId: string): Promise<NavGroup> {
    const [created] = this.db
      .insert(navGroups)
      .values({
        id: genId('g'),
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        userId,
        isPublic: userId === 'public',
      })
      .returning()
      .all();
    return this.toNavGroup(created);
  }

  async updateGroup(
    id: string,
    dto: UpdateGroupDto,
    userId: string,
  ): Promise<NavGroup> {
    const patch: Partial<typeof navGroups.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    const [updated] = this.db
      .update(navGroups)
      .set(patch)
      .where(and(eq(navGroups.id, id), eq(navGroups.userId, userId)))
      .returning()
      .all();

    if (!updated) throw new NotFoundException('分组不存在');
    return this.toNavGroup(updated);
  }

  async deleteGroup(id: string, userId: string): Promise<NavGroup> {
    const [deleted] = this.db
      .delete(navGroups)
      .where(and(eq(navGroups.id, id), eq(navGroups.userId, userId)))
      .returning()
      .all();

    if (!deleted) throw new NotFoundException('分组不存在');
    return this.toNavGroup(deleted);
  }

  // ============ Cards ============

  async getAll(
    userId: string,
    isPublic: boolean = true,
  ): Promise<NavDataResponse> {
    const groups = this.db
      .select()
      .from(navGroups)
      .where(
        isPublic
          ? eq(navGroups.isPublic, true)
          : or(eq(navGroups.userId, userId), eq(navGroups.isPublic, true)),
      )
      .orderBy(asc(navGroups.sortOrder))
      .all();

    const allCards = this.db
      .select()
      .from(navCards)
      .where(
        isPublic
          ? eq(navCards.isPublic, true)
          : or(eq(navCards.userId, userId), eq(navCards.isPublic, true)),
      )
      .orderBy(asc(navCards.sortOrder))
      .all();

    const cardsByGroup = new Map<string, NavCard[]>();
    const ungrouped: NavCard[] = [];

    for (const card of allCards) {
      const navCard = this.toNavCard(card);
      if (card.groupId) {
        const list = cardsByGroup.get(card.groupId) ?? [];
        list.push(navCard);
        cardsByGroup.set(card.groupId, list);
      } else {
        ungrouped.push(navCard);
      }
    }

    const groupsWithCards: NavGroupWithCards[] = groups.map((g) => ({
      ...this.toNavGroup(g),
      cards: cardsByGroup.get(g.id) ?? [],
    }));

    return { groups: groupsWithCards, ungrouped };
  }

  async createCard(dto: CreateCardDto, userId: string): Promise<NavCard> {
    const [created] = this.db
      .insert(navCards)
      .values({
        id: genId('c'),
        name: dto.name,
        url: dto.url,
        icon: dto.icon ?? null,
        iconType: dto.iconType ?? 'emoji',
        groupId: dto.groupId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        intranetUrl: dto.intranetUrl ?? '',
        extranetUrl: dto.extranetUrl ?? '',
        userId,
        isPublic: userId === 'public',
      })
      .returning()
      .all();
    return this.toNavCard(created);
  }

  async updateCard(
    id: string,
    dto: UpdateCardDto,
    userId: string,
  ): Promise<NavCard> {
    const patch: Partial<typeof navCards.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.url !== undefined) patch.url = dto.url;
    if (dto.icon !== undefined) patch.icon = dto.icon ?? null;
    if (dto.iconType !== undefined) patch.iconType = dto.iconType;
    if (dto.groupId !== undefined) patch.groupId = dto.groupId ?? null;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.intranetUrl !== undefined) patch.intranetUrl = dto.intranetUrl;
    if (dto.extranetUrl !== undefined) patch.extranetUrl = dto.extranetUrl;

    const [updated] = this.db
      .update(navCards)
      .set(patch)
      .where(and(eq(navCards.id, id), eq(navCards.userId, userId)))
      .returning()
      .all();

    if (!updated) throw new NotFoundException('卡片不存在');
    return this.toNavCard(updated);
  }

  async deleteCard(id: string, userId: string): Promise<NavCard> {
    const [deleted] = this.db
      .delete(navCards)
      .where(and(eq(navCards.id, id), eq(navCards.userId, userId)))
      .returning()
      .all();

    if (!deleted) throw new NotFoundException('卡片不存在');
    return this.toNavCard(deleted);
  }

  async reorderCards(
    dto: ReorderCardsDto,
    userId: string,
  ): Promise<NavCard[]> {
    const updatedCards: NavCard[] = [];
    const tx = this.db.transaction((txDb) => {
      const results: NavCard[] = [];
      for (const item of dto.items) {
        const [updated] = txDb
          .update(navCards)
          .set({
            sortOrder: item.sortOrder,
            groupId: item.groupId ?? null,
          })
          .where(and(eq(navCards.id, item.id), eq(navCards.userId, userId)))
          .returning()
          .all();
        if (!updated) {
          throw new NotFoundException(`卡片不存在: ${item.id}`);
        }
        results.push(this.toNavCard(updated));
      }
      return results;
    });
    updatedCards.push(...tx);
    return updatedCards;
  }

  // ============ Helpers ============

  private toNavGroup(row: typeof navGroups.$inferSelect): NavGroup {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    };
  }

  private toNavCard(row: typeof navCards.$inferSelect): NavCard {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      icon: row.icon ?? null,
      iconType: row.iconType as 'emoji' | 'image' | 'favicon',
      groupId: row.groupId ?? null,
      sortOrder: row.sortOrder,
      intranetUrl: row.intranetUrl,
      extranetUrl: row.extranetUrl,
    };
  }
}
