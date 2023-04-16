import {MigrationFn} from 'data-api-migrations'
import {MigrationTransaction} from '../migration-utils'

export const up: MigrationFn = async (dataAPI) => {
  const t = await MigrationTransaction.create(dataAPI)
  try {
    await t.query(`CREATE TABLE IF NOT EXISTS commit_map
                   (
                       ts        TIMESTAMP default now(),
                       commit    TEXT NOT NULL,
                       custom_id TEXT NOT NULL,
                       UNIQUE (commit, custom_id)
                   )`)
    await t.query('CREATE INDEX commit_map_idx ON commit_map (commit)')
    const {records: data1} = await t.query(`
        SELECT '(' || string_agg(custom_id || '(?=[^0-9])', '|') || ')'
        FROM task_list`)
    const pattern = data1[0][0].stringValue
    await t.query(`
        WITH commits AS (
            SELECT jsonb_array_elements(body -> 'commits') ->> 'id'      AS id,
                   jsonb_array_elements(body -> 'commits') ->> 'message' AS msg
            FROM events
            WHERE type = 'push'
        )
        INSERT
        INTO commit_map(commit, custom_id)
        SELECT id,
               substring(msg FROM '${pattern}')
        FROM commits
        WHERE msg ~ '${pattern}'
        GROUP BY 1, 2
        ORDER BY id
        ON CONFLICT DO NOTHING
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
    await t.query('DROP TABLE IF EXISTS commit_map CASCADE')
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
  }
}
