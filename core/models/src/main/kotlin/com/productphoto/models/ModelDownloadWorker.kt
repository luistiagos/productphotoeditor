package com.productphoto.models

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Baixa um modelo (ARQUITETURA §16.4 task 3). Recebe a [ModelEntry] em JSON e o diretório no `inputData`,
 * então não depende do grafo do app. Erro de rede → `retry` (o `.part` é retomado); falha permanente →
 * `failure` com o motivo em [KEY_ERROR].
 */
class ModelDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val entry = ModelCatalog.json.decodeFromString(ModelEntry.serializer(), inputData.getString(KEY_ENTRY)!!)
        val dir = File(inputData.getString(KEY_DIR)!!)
        Log.i(TAG, "${entry.id}: tentativa ${runAttemptCount + 1}")
        return try {
            ModelDownloader(log = { Log.i(TAG, it) }).download(entry, dir) { done, total ->
                setProgress(Data.Builder().putLong(KEY_DONE, done).putLong(KEY_TOTAL, total).build())
            }
            Log.i(TAG, "${entry.id}: pronto")
            Result.success()
        } catch (e: CancellationException) {
            throw e
        } catch (e: DownloadFailure) {
            Log.w(TAG, "${entry.id}: ${e.message}")
            Result.failure(failure(e.message ?: "falha", e is DownloadFailure.Corrupt))
        } catch (e: IOException) {
            Log.w(TAG, "${entry.id}: ${e.message}")
            if (runAttemptCount + 1 >= MAX_ATTEMPTS) Result.failure(failure("rede: ${e.message}", false)) else Result.retry()
        }
    }

    private fun failure(reason: String, corrupt: Boolean) =
        Data.Builder().putString(KEY_ERROR, reason).putBoolean(KEY_CORRUPT, corrupt).build()

    companion object {
        const val TAG = "ModelDownload"
        const val KEY_ENTRY = "entry"
        const val KEY_DIR = "dir"
        const val KEY_DONE = "done"
        const val KEY_TOTAL = "total"
        const val KEY_ERROR = "error"
        const val KEY_CORRUPT = "corrupt"
        const val MAX_ATTEMPTS = 8
    }
}

class WorkDownloadScheduler(context: Context) : DownloadScheduler {
    private val work = WorkManager.getInstance(context.applicationContext)

    private fun name(modelId: String) = "model-$modelId"

    override fun enqueue(entry: ModelEntry, dir: File) {
        val input = Data.Builder()
            .putString(ModelDownloadWorker.KEY_ENTRY, ModelCatalog.json.encodeToString(ModelEntry.serializer(), entry))
            .putString(ModelDownloadWorker.KEY_DIR, dir.absolutePath)
            .build()
        val request = OneTimeWorkRequest.Builder(ModelDownloadWorker::class.java)
            .setInputData(input)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        work.enqueueUniqueWork(name(entry.id), ExistingWorkPolicy.KEEP, request)
    }

    override fun cancel(modelId: String) {
        work.cancelUniqueWork(name(modelId))
    }

    override fun status(modelId: String): Flow<DownloadStatus?> =
        work.getWorkInfosForUniqueWorkFlow(name(modelId)).map { infos -> infos.lastOrNull()?.let(::toStatus) }

    private fun toStatus(info: WorkInfo): DownloadStatus? = when (info.state) {
        WorkInfo.State.ENQUEUED, WorkInfo.State.RUNNING, WorkInfo.State.BLOCKED -> {
            val done = info.progress.getLong(ModelDownloadWorker.KEY_DONE, -1)
            val total = info.progress.getLong(ModelDownloadWorker.KEY_TOTAL, -1)
            DownloadStatus.Active(if (done >= 0 && total > 0) done.toFloat() / total else null)
        }
        WorkInfo.State.FAILED -> DownloadStatus.Failed(
            info.outputData.getString(ModelDownloadWorker.KEY_ERROR) ?: "falha",
            info.outputData.getBoolean(ModelDownloadWorker.KEY_CORRUPT, false),
        )
        WorkInfo.State.SUCCEEDED -> DownloadStatus.Done
        WorkInfo.State.CANCELLED -> null
    }
}
