module.exports = async ({ resolveVariable }) => {
  const enabled = await resolveVariable('self:custom.udexp.stalePR.enabled')
  if (!enabled) {
    return []
  }
  const schedule = await resolveVariable('self:custom.udexp.stalePR.schedule')
  if (!schedule) {
    throw new Error('Could not find `custom.udexp.stalePR.schedule` in config')
  }
  return [{ schedule }]
}
