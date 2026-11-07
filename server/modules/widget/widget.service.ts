import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, count } from 'drizzle-orm';
import { navWidgets } from '@server/database/sqlite-schema';
import { SQLITE_DATABASE } from '@server/database/database.service';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  Widget,
  WidgetLayout,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  BatchUpdateLayoutRequest,
  WidgetType,
} from '@shared/api.interface';

function genId(): string {
  return `wgt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToWidget(row: {
  id: string;
  widgetType: string;
  title: string | null;
  config: string;
  gridCol: number;
  gridRow: number;
  sizeW: number;
  sizeH: number;
  sortOrder: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Widget {
  let config: Record<string, any> = {};
  try {
    config = JSON.parse(row.config);
  } catch {
    config = {};
  }
  return {
    id: row.id,
    widgetType: row.widgetType as Widget['widgetType'],
    title: row.title ?? undefined,
    config,
    gridCol: row.gridCol,
    gridRow: row.gridRow,
    sizeW: row.sizeW,
    sizeH: row.sizeH,
    sortOrder: row.sortOrder,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    @Inject(SQLITE_DATABASE)
    private readonly db: BetterSQLite3Database<
      typeof import('@server/database/sqlite-schema')
    >,
  ) {}

  async getPublicLayout(gridCols = 6): Promise<WidgetLayout> {
    const rows = this.db
      .select({
        id: navWidgets.id,
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
        isPublic: navWidgets.isPublic,
        createdAt: navWidgets.createdAt,
        updatedAt: navWidgets.updatedAt,
      })
      .from(navWidgets)
      .where(eq(navWidgets.userId, 'public'))
      .orderBy(navWidgets.gridRow, navWidgets.gridCol, navWidgets.sortOrder)
      .all();

    return {
      widgets: rows.map((r) => rowToWidget(r)),
      gridCols,
    };
  }

  async getUserLayout(userId: string, gridCols = 6): Promise<WidgetLayout> {
    const rows = this.db
      .select({
        id: navWidgets.id,
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
        isPublic: navWidgets.isPublic,
        createdAt: navWidgets.createdAt,
        updatedAt: navWidgets.updatedAt,
      })
      .from(navWidgets)
      .where(eq(navWidgets.userId, userId))
      .orderBy(navWidgets.gridRow, navWidgets.gridCol, navWidgets.sortOrder)
      .all();

    // 用户没有自定义布局时，从 public 复制一份作为初始布局
    if (rows.length === 0) {
      return this.initializeUserLayout(userId, gridCols);
    }

    return {
      widgets: rows.map((r) => rowToWidget(r)),
      gridCols,
    };
  }

  private initializeUserLayout(userId: string, gridCols: number): WidgetLayout {
    const publicRows = this.db
      .select({
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
      })
      .from(navWidgets)
      .where(eq(navWidgets.userId, 'public'))
      .orderBy(navWidgets.gridRow, navWidgets.gridCol, navWidgets.sortOrder)
      .all();

    if (publicRows.length === 0) {
      return { widgets: [], gridCols };
    }

    const now = new Date();
    const values = publicRows.map((r) => ({
      id: genId(),
      userId,
      widgetType: r.widgetType,
      title: r.title ?? null,
      config: r.config,
      gridCol: r.gridCol,
      gridRow: r.gridRow,
      sizeW: r.sizeW,
      sizeH: r.sizeH,
      sortOrder: r.sortOrder,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    }));

    this.db.insert(navWidgets).values(values).run();

    return {
      widgets: values.map((w) => ({
        id: w.id,
        widgetType: w.widgetType as WidgetType,
        title: w.title ?? undefined,
        config: JSON.parse(w.config || '{}'),
        gridCol: w.gridCol,
        gridRow: w.gridRow,
        sizeW: w.sizeW,
        sizeH: w.sizeH,
        sortOrder: w.sortOrder,
        isPublic: false,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      gridCols,
    };
  }

  async create(
    dto: CreateWidgetRequest,
    userId: string,
  ): Promise<Widget> {
    const [created] = this.db
      .insert(navWidgets)
      .values({
        id: genId(),
        userId,
        widgetType: dto.widgetType,
        title: dto.title ?? null,
        config: dto.config ? JSON.stringify(dto.config) : '{}',
        gridCol: dto.gridCol,
        gridRow: dto.gridRow,
        sizeW: dto.sizeW,
        sizeH: dto.sizeH,
        sortOrder: 0,
        isPublic: userId === 'public',
      })
      .returning({
        id: navWidgets.id,
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
        isPublic: navWidgets.isPublic,
        createdAt: navWidgets.createdAt,
        updatedAt: navWidgets.updatedAt,
      })
      .all();

    return rowToWidget(created);
  }

  async update(
    id: string,
    dto: UpdateWidgetRequest,
    userId: string,
  ): Promise<Widget> {
    const patch: Partial<typeof navWidgets.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title ?? null;
    if (dto.config !== undefined) patch.config = JSON.stringify(dto.config);
    if (dto.gridCol !== undefined) patch.gridCol = dto.gridCol;
    if (dto.gridRow !== undefined) patch.gridRow = dto.gridRow;
    if (dto.sizeW !== undefined) patch.sizeW = dto.sizeW;
    if (dto.sizeH !== undefined) patch.sizeH = dto.sizeH;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = this.db
      .update(navWidgets)
      .set(patch)
      .where(and(eq(navWidgets.id, id), eq(navWidgets.userId, userId)))
      .returning({
        id: navWidgets.id,
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
        isPublic: navWidgets.isPublic,
        createdAt: navWidgets.createdAt,
        updatedAt: navWidgets.updatedAt,
      })
      .all();

    if (updated.length === 0) {
      throw new NotFoundException('Widget 不存在');
    }

    return rowToWidget(updated[0]);
  }

  async remove(id: string, userId: string): Promise<void> {
    const deleted = this.db
      .delete(navWidgets)
      .where(and(eq(navWidgets.id, id), eq(navWidgets.userId, userId)))
      .returning({ id: navWidgets.id })
      .all();

    if (deleted.length === 0) {
      throw new NotFoundException('Widget 不存在');
    }
  }

  async batchUpdateLayout(
    dto: BatchUpdateLayoutRequest,
    userId: string,
  ): Promise<{ updated: number }> {
    if (!dto.widgets || dto.widgets.length === 0) {
      throw new BadRequestException('未提供更新数据');
    }

    let updatedCount = 0;
    this.db.transaction((tx) => {
      for (const w of dto.widgets) {
        const result = tx
          .update(navWidgets)
          .set({
            gridCol: w.gridCol,
            gridRow: w.gridRow,
            sizeW: w.sizeW,
            sizeH: w.sizeH,
          })
          .where(and(eq(navWidgets.id, w.id), eq(navWidgets.userId, userId)))
          .returning({ id: navWidgets.id })
          .all();
        updatedCount += result.length;
      }
    });

    return { updated: updatedCount };
  }

  async resetLayout(
    userId: string,
    template: 'default' | 'compact' | 'dense' = 'default',
  ): Promise<WidgetLayout> {
    // 从 public 布局复制作为默认（先读再删，避免 userId=public 时自己删自己）
    const publicRows = this.db
      .select({
        widgetType: navWidgets.widgetType,
        title: navWidgets.title,
        config: navWidgets.config,
        gridCol: navWidgets.gridCol,
        gridRow: navWidgets.gridRow,
        sizeW: navWidgets.sizeW,
        sizeH: navWidgets.sizeH,
        sortOrder: navWidgets.sortOrder,
      })
      .from(navWidgets)
      .where(eq(navWidgets.userId, 'public'))
      .orderBy(navWidgets.gridRow, navWidgets.gridCol, navWidgets.sortOrder)
      .all();

    // 删除用户的所有 widget
    this.db
      .delete(navWidgets)
      .where(eq(navWidgets.userId, userId))
      .run();

    if (template === 'compact') {
      // compact: 更紧凑的布局，去除时钟、天气大组件，只保留搜索 + nav_card
      const compactRows = publicRows.filter(
        (r) => r.widgetType === 'search' || r.widgetType === 'nav_card',
      );
      // 重排到从第 0 行开始
      const GRID_COLS = 6;
      const repositioned = compactRows.map((r, i) => {
        const row = Math.floor(i / GRID_COLS);
        const col = i % GRID_COLS;
        return { ...r, gridRow: row, gridCol: col, sortOrder: i };
      });
      const newWidgets = repositioned.map((r) => ({
        id: genId(),
        userId,
        widgetType: r.widgetType,
        title: r.title,
        config: r.config,
        gridCol: r.gridCol,
        gridRow: r.gridRow,
        sizeW: r.sizeW,
        sizeH: r.sizeH,
        sortOrder: r.sortOrder,
        isPublic: userId === 'public',
      }));
      if (newWidgets.length > 0) {
        this.db.insert(navWidgets).values(newWidgets).run();
      }
    } else if (template === 'dense') {
      // dense: 保留全部，但 sizeW 统一为 1（除搜索占满整行），更紧凑
      const GRID_COLS = 6;
      const repositioned: typeof publicRows = [];
      let col = 0;
      let row = 0;
      for (const w of publicRows) {
        const wSize = w.widgetType === 'search' ? GRID_COLS : 1;
        if (col + wSize > GRID_COLS) {
          row += 1;
          col = 0;
        }
        repositioned.push({
          ...w,
          gridCol: col,
          gridRow: row,
          sizeW: wSize,
          sizeH: 1,
          sortOrder: repositioned.length,
        });
        col += wSize;
      }
      const newWidgets = repositioned.map((r) => ({
        id: genId(),
        userId,
        widgetType: r.widgetType,
        title: r.title,
        config: r.config,
        gridCol: r.gridCol,
        gridRow: r.gridRow,
        sizeW: r.sizeW,
        sizeH: r.sizeH,
        sortOrder: r.sortOrder,
        isPublic: userId === 'public',
      }));
      if (newWidgets.length > 0) {
        this.db.insert(navWidgets).values(newWidgets).run();
      }
    } else {
      // default: 直接复制 public 布局
      const newWidgets = publicRows.map((r) => ({
        id: genId(),
        userId,
        widgetType: r.widgetType,
        title: r.title,
        config: r.config,
        gridCol: r.gridCol,
        gridRow: r.gridRow,
        sizeW: r.sizeW,
        sizeH: r.sizeH,
        sortOrder: r.sortOrder,
        isPublic: userId === 'public',
      }));
      if (newWidgets.length > 0) {
        this.db.insert(navWidgets).values(newWidgets).run();
      }
    }

    return this.getUserLayout(userId);
  }

  async applyTemplate(
    userId: string,
    templateName: string,
  ): Promise<WidgetLayout> {
    const validTemplates = ['default', 'compact', 'dense'] as const;
    if (!validTemplates.includes(templateName as typeof validTemplates[number])) {
      throw new BadRequestException(`无效的模板名称: ${templateName}`);
    }
    return this.resetLayout(userId, templateName as typeof validTemplates[number]);
  }

  // 仅用于计数（健康检查/诊断）
  async countByUser(userId: string): Promise<number> {
    const result = this.db
      .select({ count: count() })
      .from(navWidgets)
      .where(eq(navWidgets.userId, userId))
      .all();
    return result[0]?.count ?? 0;
  }
}
