import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { api } from '@/api/client'

/** Realtime-updated count of support_messages with status = new (admin inbox badge). */
export function useSupportNewCount(enabled: boolean) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const { count: c } = await api.support.getNewCount()
      setCount(c)
    } catch {
      setCount(0)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    refresh()
    if (!supabase) return
    const channel = supabase
      .channel('support_messages_new_count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: 'status=eq.new',
        },
        () => {
          refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_messages' },
        () => {
          refresh()
        }
      )
      .subscribe()
    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh])

  return count
}
