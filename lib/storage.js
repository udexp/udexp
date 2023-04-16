import {
  RDSDataClient,
  ExecuteStatementCommand,
  TypeHint,
  BatchExecuteStatementCommand
} from '@aws-sdk/client-rds-data'

export class DB {
  constructor (options) {
    this.options = options
    this.client = new RDSDataClient({ region: process.env.AWS_REGION })
  }

  async sql (sql, parameters) {
    const command = new ExecuteStatementCommand({
      ...this.options,
      sql,
      parameters,
    })
    return this.client.send(command)
  }

  async batch (sql, parameterSets) {
    const command = new BatchExecuteStatementCommand({
      ...this.options,
      sql,
      parameterSets,
    })
    return this.client.send(command)
  }

  async insertEvent (data) {
    return this.sql(
      `INSERT INTO events
       VALUES (to_timestamp(:ts), :delivery, :type, :sender, :repo, :action, :body)`,
      [
        { name: 'ts', value: { doubleValue: data.epoch } },
        { name: 'delivery', value: { stringValue: data.delivery }, typeHint: TypeHint.UUID },
        { name: 'type', value: { stringValue: data.type } },
        { name: 'sender', value: { stringValue: data.sender } },
        { name: 'repo', value: { stringValue: data.repo } },
        { name: 'action', value: { stringValue: data.action } },
        { name: 'body', value: { stringValue: JSON.stringify(data.body) }, typeHint: TypeHint.JSON },
      ]
    )
  }

  async insertTaskEvent (data) {
    return this.sql(
      `INSERT INTO task_events
       VALUES (to_timestamp(:ts), :id::bigint, :event, :sender, :task_id, :custom_id, :name, :parent_id::bigint,
               :body)`,
      [
        { name: 'ts', value: { doubleValue: data.epoch } },
        { name: 'id', value: { stringValue: data.id } },
        { name: 'event', value: { stringValue: data.event } },
        { name: 'sender', value: { stringValue: data.sender } },
        { name: 'task_id', value: { stringValue: data.task_id } },
        { name: 'custom_id', value: { stringValue: data.custom_id } },
        { name: 'name', value: { stringValue: data.name } },
        { name: 'parent_id', value: { stringValue: data.parent_id } },
        { name: 'body', value: { stringValue: JSON.stringify(data.body) }, typeHint: TypeHint.JSON },
      ]
    )
  }

  async updateTaskList (data, taskUrl) {
    return this.sql(
      `
          INSERT INTO task_list(custom_id, url)
          VALUES (:custom_id, :url)
          ON CONFLICT DO NOTHING`,
      [
        { name: 'custom_id', value: { stringValue: data.custom_id } },
        { name: 'url', value: { stringValue: `${taskUrl}${data.custom_id}` } },
      ]
    )
  }

  async getAllTasks () {
    const res = await this.sql(`
        SELECT custom_id
        FROM task_list
        ORDER BY ts DESC`)
    return res.records.map(item => {
      return item[0].stringValue
    })
  }

  async insertCommitMappings (commits) {
    return this.batch(`
                INSERT INTO commit_map(commit, custom_id)
                VALUES (:commit, :custom_id)
                ON CONFLICT DO NOTHING`,
      commits)
  }
}
