// klient KoboldCpp – jedine misto, ktere mluvi se serverem

const SERVER = "http://127.0.0.1:5001"

// GET, nebo POST kdyz je body. vrati JSON, u streamu telo odpovedi
async function call(path, body) {
  const res = await fetch(SERVER + path, body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => { throw new Error(`KoboldCpp is not running at ${SERVER}. Start it with start.bat.`) })
  if (!res.ok) throw new Error(`KoboldCpp ${path} returned ${res.status}`)
  return body?.stream ? res.body : res.json()
}

// pocet tokenu textu podle tokenizeru nacteneho modelu
export const tokens = async text => (await call("/api/extra/tokencount", { prompt: text })).value

// skutecna velikost kontextu, se kterou server bezi
export const contextSize = async () => (await call("/api/extra/true_max_context_length")).value

// posle chat a kousky odpovedi prubezne predava do onText. vrati text a jestli ho usekl limit tokenu
export async function chat(messages, max_tokens, samplers, onText = () => {}) {
  const stream = await call("/v1/chat/completions", { messages, max_tokens, stream: true, ...samplers })
  let text = "", rest = "", finish
  for await (const chunk of stream.pipeThrough(new TextDecoderStream())) {
    const lines = (rest + chunk).split("\n")
    rest = lines.pop() // posledni radek jeste nemusi byt cely
    for (const line of lines) {
      if (!line.startsWith("data: {")) continue // prazdne radky a "data: [DONE]"
      const { finish_reason, delta } = JSON.parse(line.slice(6)).choices[0]
      finish = finish_reason ?? finish
      text += delta.content ?? ""
      onText(delta.content ?? "")
    }
  }
  if (finish != "stop" && finish != "length") throw new Error("KoboldCpp did not finish the reply.")
  return { text, cut: finish == "length" }
}
