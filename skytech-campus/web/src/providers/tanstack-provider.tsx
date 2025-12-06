'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function TanstackProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000 * 5, // 5 dakika boyunca veri taze sayılsın (tekrar çekmesin)
                gcTime: 1000 * 60 * 60 * 24, // 24 saat boyunca hafızada tut (Offline için kritik)
                retry: 1, // Hata alırsan 1 kere daha dene
                refetchOnWindowFocus: false, // Başka sekmeye geçip dönünce tekrar çekme
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
