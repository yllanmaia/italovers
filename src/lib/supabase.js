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
           * Desligado: o login e por e-mail e senha, entao nao ha token nenhum
           * voltando pela URL pra detectar. O app nao manda e-mail nenhum.
           */
          detectSessionInUrl: false,
        },
      })
    : null

/** Pra tela poder dizer "sincronizando" ou "so neste aparelho". */
export const temBackend = supabase != null
