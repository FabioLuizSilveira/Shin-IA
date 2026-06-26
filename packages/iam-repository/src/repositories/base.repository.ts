import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BaseRepositoryDeps {
  db: SupabaseClient<any, any, any>;
}

export abstract class BaseRepository<T, Row> {
  public db: SupabaseClient;

  constructor(deps: BaseRepositoryDeps) {
    this.db = deps.db;
  }

  abstract getTableName(): string;
  abstract toDomain(row: Row): T;
  abstract toRow(entity: T): Row;

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Row);
  }

  async findAll(limit?: number, offset?: number): Promise<T[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.db.from(this.getTableName()).select("*").is("deleted_at", null);

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as Row[]).map((row) => this.toDomain(row));
  }

  async create(entity: T): Promise<T> {
    const row = this.toRow(entity);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.db as any)
      .from(this.getTableName())
      .insert([row])
      .select()
      .single();

    if (error || !data) throw error || new Error("Creation failed");
    return this.toDomain(data as Row);
  }

  async update(entity: T): Promise<T> {
    const row = this.toRow(entity);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.db as any)
      .from(this.getTableName())
      .update(row)
      .eq("id", (row as any).id)
      .select()
      .single();

    if (error || !data) throw error || new Error("Update failed");
    return this.toDomain(data as Row);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.getTableName())
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await this.db.from(this.getTableName()).delete().eq("id", id);

    if (error) throw error;
  }

  async restore(id: string): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .update({ deleted_at: null })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return this.toDomain(data as Row);
  }
}
