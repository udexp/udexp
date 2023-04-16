import * as AuroraDataAPI from "aurora-data-api"

export class UUIDValue implements AuroraDataAPI.CustomValue {
  private readonly value: string

  constructor(value: string) {
    this.value = value
  }

  toSqlParameter(): AuroraDataAPI.SqlParameter {
    return {
      typeHint: "UUID",
      value: {
        stringValue: this.value
      }
    }
  }

  toString() {
    return this.value
  }
}

/**
 *  Fix the brain-dead RDSDataService parameter mapping implementation
 *  Will check if objects have more keys than SQL query needs and filter them out
 */
export class MigrationTransaction extends AuroraDataAPI.Transaction {
  static async create(dataAPI: AuroraDataAPI) {
    const transaction = await dataAPI.beginTransaction()
    return new MigrationTransaction(transaction.dataApi, transaction.transactionId, transaction.requestConfig)
  }

  async query<T = AuroraDataAPI.UnknownRow>(sql: string, params?: AuroraDataAPI.QueryParams, options?: AuroraDataAPI.Transaction.QueryOptions): Promise<AuroraDataAPI.QueryResult<T>> {
    const filteredParams = params ? filterParams(sql, params) : undefined
    return super.query(sql, filteredParams, options)
  }

  async batchQuery(sql: string, params?: AuroraDataAPI.QueryParams[]): Promise<AuroraDataAPI.BatchQueryResult> {
    const filteredParams = params ? params.map(p => filterParams(sql, p)) : []
    return super.batchQuery(sql, filteredParams)
  }
}

function filterParams(sql: string, params: AuroraDataAPI.QueryParams): AuroraDataAPI.QueryParams {
  return Object.keys(params).filter(value => {
    // match `:some_identifier` in SQL when not followed by alphanumeric or at the end of string
    return sql.match(`:${value}([^\\w\\d_]|$)`)
  }).reduce((obj, key) => {
    // yep, brain-dead stuff: unavoidable copying of the whole param list just to suit RDSDataService idiocy
    // they will copy it on their side too when substituting `:ids` ...
    obj[key] = params[key]
    return obj
  }, {})
}
