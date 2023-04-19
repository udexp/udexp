import { MigrationFn } from 'data-api-migrations'
import { MigrationTransaction } from '../migration-utils'

export const up: MigrationFn = async (dataAPI) => {
  const t = await MigrationTransaction.create(dataAPI)
  try {
    await t.query(`CREATE TABLE IF NOT EXISTS task_list
                   (
                       ts        TIMESTAMP default now(),
                       custom_id TEXT NOT NULL UNIQUE,
                       url       TEXT NOT NULL
                   )`)
    await t.query('CREATE INDEX task_list_idx ON task_list(ts, custom_id)')
    await t.query(`
        INSERT
        INTO task_list(custom_id, url)
        SELECT DISTINCT custom_id, 'https://app.clickup.com/t/24317152/' || custom_id
        FROM task_events
    `)
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}

export const down: MigrationFn = async (dataAPI) => {
  const t = await MigrationTransaction.create(dataAPI)
  try {
    await t.query('DROP TABLE IF EXISTS task_list CASCADE')
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}
