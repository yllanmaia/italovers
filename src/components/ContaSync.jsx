import { useState } from 'react'
import Icon from './Icon.jsx'
import { temBackend } from '../lib/supabase.js'

/**
 * Conta, status de sincronizacao e o botao de limpar tudo.
 *
 * Fica no fim da aba Notas e nao na porta do app de proposito: o PWA precisa
 * abrir sem sinal, e uma tela de login na frente faria ele deixar de abrir no
 * aviao e no metro de Roma. Deslogado, o app funciona igual — so nao sincroniza.
 */
export default function ContaSync({ auth, sync, onLimparTudo }) {
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  if (!temBackend) {
    return (
      <Bloco>
        <p className="text-[0.875rem] leading-relaxed text-fg-dim">
          Este app está rodando <strong className="text-fg">só neste aparelho</strong>.
          Sem as chaves do servidor configuradas, o que vocês marcarem fica aqui e não vai
          pro outro celular.
        </p>
      </Bloco>
    )
  }

  if (auth.sessao) {
    return (
      <Bloco>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-olive-soft text-olive">
            <Icon name="check" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.875rem] font-bold text-fg">{auth.email}</p>
            <p className="text-[0.75rem] text-fg-faint">
              {sync.sincronizando
                ? 'sincronizando…'
                : sync.naFila > 0
                  ? `${sync.naFila} ${sync.naFila === 1 ? 'alteração pendente' : 'alterações pendentes'}`
                  : 'tudo sincronizado'}
            </p>
          </div>
          <button
            type="button"
            onClick={auth.sair}
            className="min-h-11 shrink-0 cursor-pointer rounded-full border border-line px-4 text-[0.8125rem] font-bold text-fg-dim transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sair
          </button>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          {confirmandoLimpeza ? (
            <>
              <p className="text-[0.875rem] leading-snug text-fg">
                Apagar <strong>todos</strong> os visitados e todas as avaliações, aqui e
                no servidor? Isso não tem volta.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onLimparTudo()
                    setConfirmandoLimpeza(false)
                  }}
                  className="min-h-11 flex-1 cursor-pointer rounded-full bg-accent px-4 text-[0.875rem] font-bold text-white transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Apagar tudo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoLimpeza(false)}
                  className="min-h-11 flex-1 cursor-pointer rounded-full border border-line px-4 text-[0.875rem] font-bold text-fg-dim transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoLimpeza(true)}
              className="min-h-11 cursor-pointer text-[0.8125rem] font-semibold text-fg-faint transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Limpar visitados e avaliações
            </button>
          )}
        </div>
      </Bloco>
    )
  }

  // Deslogado: pede e-mail e depois o codigo
  return (
    <Bloco>
      <p className="text-[0.875rem] leading-relaxed text-fg-dim">
        Entrando com o e-mail, o que vocês marcarem aparece{' '}
        <strong className="text-fg">nos dois celulares</strong>. Sem entrar, o app
        funciona igual — só não sincroniza.
      </p>

      {auth.enviadoPara ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            auth.confirmarCodigo(codigo)
          }}
        >
          <p className="text-[0.8125rem] text-fg-dim">
            Enviei um código de 6 dígitos para{' '}
            <strong className="text-fg">{auth.enviadoPara}</strong>.
          </p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-label="Código de 6 dígitos"
            className="min-h-12 w-full rounded-2xl border border-line bg-deep px-4 text-center text-[1.375rem] font-bold tracking-[0.4em] text-fg tabular-nums placeholder:tracking-[0.4em] placeholder:text-fg-faint focus-visible:border-accent focus-visible:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-11 flex-1 cursor-pointer rounded-full bg-accent px-4 text-[0.875rem] font-bold text-white transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={auth.recomecar}
              className="min-h-11 cursor-pointer rounded-full border border-line px-4 text-[0.8125rem] font-bold text-fg-dim transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Trocar e-mail
            </button>
          </div>
        </form>
      ) : (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            auth.enviarCodigo(email)
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="seu@email.com"
            aria-label="Seu e-mail"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-deep px-4 text-[0.9375rem] text-fg placeholder:text-fg-faint focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            className="min-h-12 shrink-0 cursor-pointer rounded-2xl bg-accent px-4 text-[0.875rem] font-bold text-white transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Enviar código
          </button>
        </form>
      )}

      {auth.erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.8125rem] font-medium text-warn">
          <Icon name="warning" size={15} className="mt-px shrink-0" />
          {auth.erro}
        </p>
      )}
    </Bloco>
  )
}

function Bloco({ children }) {
  return (
    <section className="mt-10 rounded-3xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-[0.6875rem] font-bold tracking-[0.16em] text-fg-faint uppercase">
        Sincronização
      </h2>
      {children}
    </section>
  )
}
