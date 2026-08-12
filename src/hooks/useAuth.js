import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Sessao do Supabase, por codigo de e-mail.
 *
 * Codigo de 6 digitos e nao link clicavel: um PWA instalado tem armazenamento
 * separado do Safari, entao clicar o link no e-mail logaria o NAVEGADOR e
 * deixaria o app instalado deslogado. Com codigo, a pessoa digita dentro do
 * proprio app e a sessao cai no lugar certo.
 *
 * Sem backend configurado, tudo aqui e no-op e `sessao` fica null pra sempre —
 * o app segue funcionando local, que e o comportamento de antes.
 */
export function useAuth() {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(Boolean(supabase))
  const [erro, setErro] = useState(null)
  const [enviadoPara, setEnviadoPara] = useState(null)

  useEffect(() => {
    if (!supabase) return
    let vivo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSessao(data.session ?? null)
      setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s ?? null)
      setCarregando(false)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const enviarCodigo = useCallback(async (email) => {
    if (!supabase) return
    setErro(null)
    const limpo = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({
      email: limpo,
      // Nao cria conta nova: quem nao esta na tabela `membros` nao teria acesso
      // a nada mesmo, e deixar criar so encheria a lista de usuarios do projeto.
      options: { shouldCreateUser: true },
    })
    if (error) setErro(traduzir(error.message))
    else setEnviadoPara(limpo)
  }, [])

  const confirmarCodigo = useCallback(
    async (codigo) => {
      if (!supabase || !enviadoPara) return
      setErro(null)
      const { error } = await supabase.auth.verifyOtp({
        email: enviadoPara,
        token: codigo.trim(),
        type: 'email',
      })
      if (error) setErro(traduzir(error.message))
      else setEnviadoPara(null)
    },
    [enviadoPara],
  )

  const sair = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setEnviadoPara(null)
  }, [])

  const recomecar = useCallback(() => {
    setEnviadoPara(null)
    setErro(null)
  }, [])

  return {
    sessao,
    email: sessao?.user?.email ?? null,
    carregando,
    erro,
    enviadoPara,
    enviarCodigo,
    confirmarCodigo,
    sair,
    recomecar,
  }
}

/** As mensagens do Supabase vem em ingles e tecnicas demais pra tela. */
function traduzir(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('expired') || m.includes('invalid'))
    return 'Código inválido ou expirado.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Muitas tentativas. Espera uns minutos.'
  if (m.includes('email')) return 'E-mail inválido.'
  return 'Não deu certo. Tenta de novo.'
}
