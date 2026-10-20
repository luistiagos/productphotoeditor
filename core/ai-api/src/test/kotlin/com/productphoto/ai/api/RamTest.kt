package com.productphoto.ai.api

import org.junit.Assert.assertEquals
import org.junit.Test

class RamTest {
    @Test
    fun `MemTotal rounds up to the retail size`() {
        assertEquals(8192L, advertisedRamMb(7393))   // moto g86 (§22.2)
        assertEquals(6144L, advertisedRamMb(5500))
        assertEquals(4096L, advertisedRamMb(3600))
        assertEquals(12288L, advertisedRamMb(11200))
        assertEquals(2048L, advertisedRamMb(1900))
        assertEquals(8192L, advertisedRamMb(8192))
    }

    @Test
    fun `above 32 GB uses multiples of 8 GB and zero stays zero`() {
        assertEquals(40960L, advertisedRamMb(40000))
        assertEquals(0L, advertisedRamMb(0))
    }
}
