import { createClient } from '@supabase/supabase-js'

/**
 * O cliente do Supabase, ou `null`.
 *
 * `null` NAO e caso de erro: e o modo local, e o app inteiro sabe lidar com ele.
 * Acontece em tres situacoes legitimas — nos testes (jsdom, sem env), num clone
 * limpo do repo (as chaves estao no .env.local, que e gitignored) e se alguem
 * subir o app sem configurar nada. Nos tres, o app funciona exatamente como
 * antes de existir backend: localStorage e pronto.
 *
 * A chave publicavel fica no bundle de proposito — e pra isso que ela existe.
 * Quem protege os dados e a RLS, que so aceita e-mails cadastrados na tabela
 * `membros`. Sem login, essa chave nao le nem escreve nada.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          /**
           * Ligado pra cobrir os dois caminhos.
           *
           * O login desenhado e por codigo digitado — num PWA instalado, clicar
           * um link no e-mail abre o Safari e a sessao cairia no navegador
           * errado. Mas enquanto o template de e-mail do Supabase nao tiver o
           * `{{ .Token }}`, ele manda link; e quem abrir esse link no navegador
           * merece entrar em vez de ver uma tela que nao reage.
           */
          detectSessionInUrl: true,
        },
      })
    : null

/** Pra tela poder dizer "sincronizando" ou "so neste aparelho". */
export const temBackend = supabase != null
