import { MigrationFn } from 'data-api-migrations'
import { MigrationTransaction } from '../migration-utils'

export const up: MigrationFn = async (dataAPI) => {
  const t = await MigrationTransaction.create(dataAPI)
  try {
    await t.query(`CREATE TABLE IF NOT EXISTS events
                   (
                       ts       TIMESTAMP,
                       delivery UUID PRIMARY KEY,
                       type     VARCHAR,
                       sender   VARCHAR,
                       repo     VARCHAR,
                       action   VARCHAR,
                       body     JSONB
                   )`)
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}

export const down: MigrationFn = async (dataAPI) => {
  const t = await MigrationTransaction.create(dataAPI)
  try {
    // do nothing to avoid dropping essential table
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}
