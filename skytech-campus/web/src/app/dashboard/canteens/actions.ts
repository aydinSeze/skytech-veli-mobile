'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCanteen(formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const school_id = formData.get('school_id') as string

    if (!name || !school_id) {
        return { error: 'Kantin adı ve okul seçimi zorunludur' }
    }

    const { error } = await supabase
        .from('canteens')
        .insert({ name, school_id })

    if (error) {
        console.error('Error creating canteen:', error)
        return { error: 'Kantin oluşturulurken bir hata oluştu' }
    }

    revalidatePath('/dashboard/canteens')
    return { success: true }
}
