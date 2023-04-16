import {MigrationFn} from 'data-api-migrations'

export const up: MigrationFn = async (dataAPI) => {
  const t = await dataAPI.beginTransaction()
  try {
    await t.query(`CREATE TABLE IF NOT EXISTS task_events
                   (
                       ts        TIMESTAMP,
                       id        BIGINT PRIMARY KEY,
                       event     VARCHAR,
                       sender    VARCHAR,
                       task_id   VARCHAR,
                       custom_id VARCHAR,
                       name      VARCHAR,
                       parent_id BIGINT,
                       body      JSONB
                   )`)
    await t.query('CREATE INDEX IF NOT EXISTS task_events_ts_idx ON task_events ("ts")')
    await t.query('CREATE INDEX IF NOT EXISTS task_events_task_idx ON task_events ("task_id")')
    await t.query('CREATE INDEX IF NOT EXISTS task_events_custom_idx ON task_events ("custom_id")')
    await t.query(`CREATE INDEX IF NOT EXISTS task_events_fts_idx ON task_events
        USING gin (to_tsvector('english', "body"));`)
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}

export const down: MigrationFn = async (dataAPI) => {
  const t = await dataAPI.beginTransaction()
  try {
    // do nothing to avoid dropping essential table
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}
