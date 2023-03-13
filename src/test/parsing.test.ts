import { parseDocument } from "../util/parseDocument";

test("simple transformation should work", () => {
  const t = `
        <div style={{
            marginTop: '12px'
        }}/>
    `;
  const {
    selectedElement,
    elementName,
    insertPosition,
    styleAttr,
  } = parseDocument(t, 10);

  console.log(selectedElement, styleAttr);
  expect(selectedElement).toBeDefined();
  expect(styleAttr).toBeDefined();
  expect(styleAttr?.properties).toHaveLength(1);
  expect(styleAttr?.properties[0].key).toBe("marginTop");
  expect(styleAttr?.properties[0].value).toBe("12px");
});

test("raw numbers are suffixed with px", () => {
  const t = `
        <div style={{
            marginTop: 12
        }}/>
    `;
  const { selectedElement, styleAttr } = parseDocument(t, 10);

  expect(selectedElement).toBeDefined();
  expect(styleAttr).toBeDefined();
  expect(styleAttr?.properties).toHaveLength(1);
  expect(styleAttr?.properties[0].key).toBe("marginTop");
  expect(styleAttr?.properties[0].value).toBe("12px");
});
