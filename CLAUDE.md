# Contexto pro Claude Code

App pessoal de uma viagem de 19 dias (Alemanha, Sicília, Roma, Munique) em setembro de
2026. Usado por duas pessoas: **Yllan** e **Gigi**. Não é produto, não tem usuário além
deles dois, e as decisões abaixo refletem isso.

O `README.md` explica **o que** o app faz e **como** rodar. Este arquivo é o que não está
lá: as regras que não se negociam, o porquê de escolhas que parecem estranhas, e as
armadilhas que já custaram caro.

---

## Regras invioláveis

**Nunca reescrever, resumir ou corrigir `personal_note`.** São as anotações do casal, em
letra torta de propósito — `"menina amouuu (que menina?) A ANTONIA AMOU!!!!!!!!!"`. A voz
informal *é* o ponto. Corrigir isso destrói a única coisa do app que não dá pra recriar.

**Nada de dado sensível no repositório.** O repo é público de propósito (serve de
portfólio). PIN de hotel, código de confirmação e cartão saem pelo `npm run strip-secrets`,
que os move pro `secrets.local.json`, ignorado pelo git. O `npm run build` verifica isso
antes de buildar — se ele falhar reclamando de segredo, não contorne, corrija.

**Não inventar dado.** Foto, horário, coordenada, nota, preço: se não veio de fonte
verificável, o campo fica **vazio**. Já custou caro (ver Armadilhas). Vazio é sempre melhor
que errado — o app é usado na rua, andando.

**Sem API paga, sem key, sem cartão.** Isso elimina Google Maps JS, Mapbox e Google Places.
Se algo só resolve com key ou cartão, **pare e pergunte**, não decida sozinho. Vale também
pra dependência nova pesada.

---

## Decisões fechadas — não reabrir

| Decisão | Por quê |
|---|---|
| **Um branch de trabalho**, não um por spec | Já foi pedido explicitamente. Não criar `v3`, `v4` etc. |
| **Repo público** | É portfólio. Não é descuido |
| **Backend existe, e é Supabase** | Reverteu o "sem backend" original — são dois celulares, sem servidor o dado de um nunca chega no outro |
| **Login por e-mail + senha**, não código por e-mail | O plano grátis do Supabase parou de deixar editar o template de e-mail sem SMTP próprio |
| **E-mails são fictícios** (`yllan@italovers.app`, `gigi@italovers.app`) | São só identificador de login. Não precisam existir |
| **Vercel no plano grátis, sem `vercel.json`** | Navegação por `?tab=`, não por rota, justamente pra não precisar de rewrite |
| **Fontes auto-hospedadas**, nunca CDN | O PWA tem que abrir sem sinal. Fonte de CDN quebra offline |

---

## Arquitetura — o que não é óbvio olhando o código

**Local primeiro, sincronização depois.** `localStorage` é a fonte imediata da verdade;
o Supabase é réplica. Marcar um lugar grava local na hora e entra numa fila
(`src/hooks/useTripSync.js`); quando há rede, a fila esvazia. Sem isso, marcar um
restaurante sem sinal simplesmente não funcionaria — que é pior que o problema original.

**O merge não é por timestamp, é "quem está na fila ganha".** Está em `src/lib/sync.js`,
com comentário. Relógio de celular erra em minutos, e uma anotação que ainda não subiu
nunca pode ser apagada por um dado do servidor que a pessoa não viu — sumir na frente de
quem escreveu é o pior comportamento possível num app de anotação.

**Login é opcional e o app nunca trava esperando ele.** Deslogado, funciona exatamente como
antes: local. Sem variáveis de ambiente, `src/lib/supabase.js` exporta `null` e todo o
resto trata isso como "modo local". **É por isso que os 251 testes passam sem rede.** Se um
teste começar a exigir rede, vazou backend pro caminho offline — conserte lá, não no teste.

**Uma linha por lugar no banco, não um JSON com tudo.** Documento único faria a escrita de
um apagar a do outro. Os dois mexem no app no mesmo jantar; esse é o cenário real.

**Dois "bancos", e eles não se misturam:**

| | Onde | Como muda |
|---|---|---|
| Catálogo dos 83 lugares | `src/data/places.json`, versionado | commit + push → deploy |
| Estado do casal (visitado, notas, decisões) | Supabase | ao vivo, dos celulares |

**RLS por tabela, não por painel.** As políticas checam `private.e_membro()`, que consulta
a tabela `membros`. Quem não estiver lá não lê nem escreve, mesmo com cadastro aberto. A
função vive no schema `private` de propósito — no schema público ela vira endpoint RPC.
Criar linha em `membros` **não** cria conta: são duas coisas, e precisa das duas.

---

## Armadilhas já pagas

**`npm test` passar não significa que buildou.** Os testes não compilam CSS. Um `@utility`
aninhado dentro de `@supports` quebrou o build inteiro com 251 testes verdes. **Rode
`npm run build` antes de considerar qualquer coisa pronta.**

**Service worker teimoso.** Depois de um deploy, o app continua velho no celular até a
*segunda* recarga — a primeira só baixa o SW novo. Antes de investigar "o deploy não
subiu", teste em aba anônima. Quase sempre é cache, não deploy.

**Busca por nome ou por coordenada devolve lixo com cara de acerto.** Wikidata devolveu
"ColiseumBarcelona.jpg" pro Coliseu de Roma e uma formiga (*Formica rufa*) pro restaurante
Formica. Busca por coordenada devolve foto tirada *perto*, não foto *do lugar*. Por isso
`fetch-photos.mjs` tem tabela escrita à mão e `fetch-hours.mjs` só casa por nome contido.
Cobertura baixa é escolha, não falha: 13 de 83 lugares com foto, ~39% com horário.

**Prettier reformata o repositório inteiro.** Rodar em `src/**` sujou 13 arquivos não
tocados. Formate só o que você editou. A configuração é sem arquivo:
`--no-semi --single-quote --print-width 90`.

**Leaflet guarda o tamanho antigo do container.** Sem um `ResizeObserver` chamando
`invalidateSize`, a atribuição flutua no meio do mapa.

**Agrupar pinos por coordenada exata não resolve nada.** No zoom de continente, 4 pinos
caem a 5px um do outro com coordenadas diferentes. O agrupamento é em espaço de tela
(`latLngToLayerPoint`), redesenhado no `zoomend`.

**Estado de "aberto" tem que morar acima da lista que reordena.** Na aba Notas, a primeira
nota movia o lugar de seção, remontava a linha e fechava o editor no meio da avaliação.

**`fitBounds` com a origem inclusa esmaga a Europa.** A viagem sai do Rio; incluir o ponto
de origem nos bounds joga tudo pro canto.

---

## Fluxos comuns

**Adicionar lugar:** editar `src/data/places.json` → `npm run geocode` (Nominatim, 1 req/s)
→ `npm run sublocal` → `npm run hours` (opcional, retomável) → `npm test && npm run lint &&
npm run build` → commit → push. `personal_note`, a etapa (`phase_id`) e nota/preço só o
Yllan fornece.

**Publicar:** push na `main`. A Vercel republica sozinha em ~30s. Não existe passo manual.

**Ver na tela de celular:** `node scripts/shot.mjs "<url>" saida.png 390 844`. Mede overflow
horizontal e aponta o culpado — o defeito que só aparece em tela estreita.

**Simular a viagem** (é em setembro/2026, sem simular não há nada pra ver):
`?d=2026-09-16&t=13:30`, `?d=off`, `?tab=notas`.

---

## Máquina nova

```bash
git clone https://github.com/yllanmaia/italovers.git
cd italovers && npm install
cp .env.example .env.local     # e preencher — ver abaixo
npm run dev
```

Node 20+. A única dependência nativa é o `sharp`, usada só por `npm run photos` e
`npm run icons`, que já rodaram.

O `.env.local` **não** está no repositório e nunca vai estar. Os dois valores saem de
**Vercel → italovers → Settings → Environment Variables**, ou de
**Supabase → Project Settings → API**. Atalho, dentro da pasta do projeto:

```bash
npx vercel link && npx vercel env pull .env.local
```

Sem esse arquivo o app roda normal, só não sincroniza.

---

## Antes de dizer que terminou

```bash
npm test && npm run lint && npm run build
```

Os três, sempre. O `build` é o único que pega erro de CSS e dado sensível.
