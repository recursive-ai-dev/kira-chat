package dev.kira.chat;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.*;

public class PendingExportStoreTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();

    @Test public void recreationPreservesExactUtf8PayloadAndName() throws Exception {
        File dir = temporary.newFolder();
        PendingExportStore first = new PendingExportStore(dir);
        String text = "{\"text\":\"café, 日本語, 🌷\\nline\"}";
        PendingExportStore.Entry entry = first.stage("kira-session.json", text);
        PendingExportStore restored = new PendingExportStore(dir);
        assertEquals(entry.id, restored.peek().id);
        assertEquals("kira-session.json", restored.peek().name);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        restored.writeTo(entry.id, output);
        assertArrayEquals(text.getBytes(StandardCharsets.UTF_8), output.toByteArray());
        assertNotNull("A successful write alone must not discard a possibly unclosed file", restored.peek());
        restored.discard(entry.id);
        assertNull(restored.peek());
    }

    @Test public void pendingExportCannotBeOverwrittenOrDiscardedByStaleRequest() throws Exception {
        PendingExportStore store = new PendingExportStore(temporary.newFolder());
        PendingExportStore.Entry first = store.stage("first.json", "first");
        assertThrows(IOException.class, () -> store.stage("second.json", "second"));
        assertThrows(IOException.class, () -> store.discard("stale-id"));
        assertEquals(first.id, store.peek().id);
        store.discard(first.id);
        assertEquals("second.json", store.stage("second.json", "second").name);
    }

    @Test public void providerFailureLeavesRecoverableExport() throws Exception {
        PendingExportStore store = new PendingExportStore(temporary.newFolder());
        PendingExportStore.Entry entry = store.stage("backup.json", "{\"saved\":true}");
        OutputStream broken = new OutputStream() {
            @Override public void write(int value) throws IOException { throw new IOException("provider failed"); }
        };
        assertThrows(IOException.class, () -> store.writeTo(entry.id, broken));
        assertThrows(IOException.class, () -> store.writeTo(entry.id, null));
        assertEquals(entry.id, store.peek().id);
        ByteArrayOutputStream recovered = new ByteArrayOutputStream();
        store.writeTo(entry.id, recovered);
        assertEquals("{\"saved\":true}", recovered.toString("UTF-8"));
    }

    @Test public void malformedAndTruncatedStagingRequiresExplicitDiscard() throws Exception {
        File dir = temporary.newFolder();
        PendingExportStore store = new PendingExportStore(dir);
        PendingExportStore.Entry entry = store.stage("backup.json", "complete");
        File file = new File(dir, "pending-export.bin");
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(new byte[]{0, 1}); }
        assertThrows(IOException.class, store::peek);
        assertThrows(IOException.class, () -> store.writeTo(entry.id, new ByteArrayOutputStream()));
        assertTrue(file.exists());
        store.discardDamaged();
        assertNull(store.peek());
        store.stage("backup.json", "replacement");
        assertThrows(IllegalStateException.class, store::discardDamaged);
    }

    @Test public void stalePickerCannotWriteOrDiscardAnotherActivitysExport() throws Exception {
        File dir = temporary.newFolder();
        PendingExportStore activityA = new PendingExportStore(dir);
        PendingExportStore activityB = new PendingExportStore(dir);
        PendingExportStore.Entry first = activityA.stage("first.json", "private first payload");
        activityB.discard(first.id);
        PendingExportStore.Entry replacement = activityB.stage("second.json", "private second payload");

        ByteArrayOutputStream staleDestination = new ByteArrayOutputStream();
        assertThrows(IOException.class, () -> activityA.requireEntry(first.id));
        assertThrows(IOException.class, () -> activityA.writeTo(first.id, staleDestination));
        assertThrows(IOException.class, () -> activityA.writeTo(null, staleDestination));
        assertThrows(IOException.class, () -> activityA.discard(first.id));
        assertEquals("A stale picker must not receive any replacement bytes", 0, staleDestination.size());
        assertEquals(replacement.id, activityB.peek().id);

        ByteArrayOutputStream correctDestination = new ByteArrayOutputStream();
        activityB.writeTo(replacement.id, correctDestination);
        assertEquals("private second payload", correctDestination.toString("UTF-8"));
        activityB.discard(replacement.id);
        assertNull(activityA.peek());
    }

    @Test public void namesAndByteLimitsAreValidatedBeforePersistence() throws Exception {
        PendingExportStore store = new PendingExportStore(temporary.newFolder());
        assertThrows(IOException.class, () -> store.stage("../escape.json", "{}"));
        assertThrows(IOException.class, () -> store.stage("backup.html", "{}"));
        assertThrows(IOException.class, () -> store.stage("backup.json", null));
        // UTF-16 length is below the ceiling, but UTF-8 bytes exceed it.
        String text = "\u0800".repeat(PendingExportStore.MAX_BYTES / 3 + 1);
        assertThrows(IOException.class, () -> store.stage("backup.json", text));
        assertNull(store.peek());
    }
}
