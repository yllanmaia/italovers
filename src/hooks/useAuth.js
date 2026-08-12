import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Sessao do Supabase, por e-mail e senha.
 *
 * Comecou como codigo de 6 digitos por e-mail e nao deu: projeto no plano free
 * nao edita mais o template de e-mail sem SMTP customizado, e sem editar o
 * template o Supabase manda link em vez de codigo — que num PWA instalado loga
 * o Safari e deixa o app deslogado.
 *
 * Senha resolve sem depender de e-mail nenhum. Sao duas pessoas que se conhecem,
 * nao ha o que provar sobre a posse do endereco: os e-mails aqui sao so
 * identificador de login e nem precisam existir. Quem controla o acesso de
 * verdade e a tabela `membros`, no banco.
 *
 * Sem backend configurado tudo aqui e no-op e `sessao` fica null pra sempre — o
 * app segue local, que e o comportamento de sempre.
 */
export function useAuth() {
  const [sessao, setSessao] = useState(null)
  const [carregando, setCarregando] = useState(Boolean(supabase))
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)

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

  const entrar = useCallback(async (email, senha) => {
    if (!supabase) return
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    if (error) setErro(traduzir(error.message))
    setOcupado(false)
  }, [])

  /**
   * Roda uma vez pra cada um. Com "Confirm email" desligado no painel, o signUp
   * ja devolve sessao — nao ha e-mail de confirmacao pra esperar.
   */
  const cadastrar = useCallback(async (email, senha) => {
    if (!supabase) return
    setErro(null)
    setOcupado(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    if (error) setErro(traduzir(error.message))
    else if (!data.session) {
      // Chegou aqui com usuario e sem sessao: a confirmacao de e-mail continua
      // ligada no painel. Dizer isso e melhor que a tela ficar parada.
      setErro('Falta desligar "Confirm email" no painel do Supabase.')
    }
    setOcupado(false)
  }, [])

  const sair = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const limparErro = useCallback(() => setErro(null), [])

  return {
    sessao,
    email: sessao?.user?.email ?? null,
    carregando,
    erro,
    ocupado,
    entrar,
    cadastrar,
    sair,
    limparErro,
  }
}

/** As mensagens do Supabase vem em ingles e tecnicas demais pra tela. */
function traduzir(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha errados.'
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Essa conta já existe — é só entrar.'
  if (m.includes('password') && m.includes('6'))
    return 'A senha precisa de pelo menos 6 caracteres.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Muitas tentativas. Espera uns minutos.'
  if (m.includes('email')) return 'E-mail inválido.'
  return 'Não deu certo. Tenta de novo.'
}
