module.exports = async ({ resolveVariable }) => {
  const enabled = await resolveVariable("self:custom.udexp.clickup.enabled")
  if (!enabled) {
    return []
  }
  return [{
    sqs: {
      arn: {
        "Fn::GetAtt": [
          "ClickupIntegrationQueue",
          "Arn",
        ],
      },
    },
  }]
}
