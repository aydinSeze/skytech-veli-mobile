'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSchool(formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const address = formData.get('address') as string

    if (!name) {
        return { error: 'Okul adı zorunludur' }
    }

    const { error } = await supabase
        .from('schools')
        .insert({ name, address })

    if (error) {
        console.error('Error creating school:', error)
        return { error: 'Okul oluşturulurken bir hata oluştu' }
    }

    revalidatePath('/dashboard/schools')
    return { success: true }
}
