module.exports = async ({ resolveVariable }) => {
  try {
    const settings = await resolveVariable("self:custom.udexp.repoSync")
    return Buffer.from(JSON.stringify(settings)).toString("base64")
  } catch (e) {
    return "e30=" // it's an empty object `{}` in base64
  }
}
