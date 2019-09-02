const { fetchSearchInfoBoxes, fetchInfoBoxes } = require('./')

it('Test async fetchSearchInfoBoxes', async () => {
  expect.assertions(1)
  const iedata = await fetchSearchInfoBoxes('republic of ireland')
  expect(iedata.common_name.text).toEqual('Ireland')
})

it('Test async fetchInfoBoxes', async () => {
  expect.assertions(1)
  const iedata = await fetchInfoBoxes('Anglo-Irish_Treaty')
  expect(iedata.long_name.text).toEqual('Articles of Agreement for a Treaty Between Great Britain and Ireland')
})

it('Test async fetchSearchInfoBoxes no results', async () => {
    expect.assertions(1)
    const testdata = await fetchSearchInfoBoxes('jaksdjasldjaksdjaskldasd')
    expect(Object.keys(testdata).length).toEqual(0)
})
