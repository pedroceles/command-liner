export function makeOutput(json: boolean) {
  return (data: unknown) => {
    if (json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (data === undefined || data === null) return;
    if (typeof data === "string") {
      console.log(data);
      return;
    }
    console.log(JSON.stringify(data, null, 2));
  };
}
