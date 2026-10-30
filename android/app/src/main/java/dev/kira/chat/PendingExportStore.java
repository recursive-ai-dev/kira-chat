package dev.kira.chat;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** One durable export, kept outside Android backup storage until the picker completes. */
final class PendingExportStore {
    static final int MAX_BYTES = 32 * 1024 * 1024;
    private static final int MAGIC = 0x4b495241;
    private final File directory;
    private final File pending;

    static final class Entry {
        final String id;
        final String name;
        final int size;

        Entry(String id, String name, int size) {
            this.id = id;
            this.name = name;
            this.size = size;
        }
    }

    PendingExportStore(File directory) {
        this.directory = directory;
        this.pending = new File(directory, "pending-export.bin");
    }

    private static boolean validName(String name) {
        return name != null && name.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,122}\\.json");
    }

    Entry stage(String name, String text) throws IOException {
        if (!validName(name) || text == null || text.length() > MAX_BYTES) {
            throw new IOException("Invalid export name or oversized export");
        }
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IOException("Export exceeds 32 MiB");
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("Cannot create private export storage");
        }
        if (pending.exists()) throw new IOException("Another export is still pending");
        Entry entry = new Entry(UUID.randomUUID().toString(), name, bytes.length);
        File temporary = File.createTempFile("export-", ".tmp", directory);
        try {
            try (FileOutputStream file = new FileOutputStream(temporary);
                 DataOutputStream out = new DataOutputStream(file)) {
                out.writeInt(MAGIC);
                out.writeUTF(entry.id);
                out.writeUTF(entry.name);
                out.writeInt(entry.size);
                out.write(bytes);
                out.flush();
                file.getFD().sync();
            }
            if (!temporary.renameTo(pending)) throw new IOException("Cannot stage the export");
        } finally {
            if (temporary.exists() && !temporary.delete()) temporary.deleteOnExit();
        }
        return entry;
    }

    private Entry header(DataInputStream in) throws IOException {
        if (in.readInt() != MAGIC) throw new IOException("Invalid pending export");
        String id = in.readUTF();
        String name = in.readUTF();
        int size = in.readInt();
        if (!id.matches("[a-f0-9-]{36}") || !validName(name)
                || size < 0 || size > MAX_BYTES || in.available() != size) {
            throw new IOException("Damaged pending export");
        }
        return new Entry(id, name, size);
    }

    Entry peek() throws IOException {
        if (!pending.exists()) return null;
        try (DataInputStream in = new DataInputStream(new FileInputStream(pending))) {
            return header(in);
        }
    }

    Entry requireEntry(String expectedId) throws IOException {
        Entry entry = peek();
        if (entry == null || !entry.id.equals(expectedId)) {
            throw new IOException("The pending export changed");
        }
        return entry;
    }

    /** Does not delete the source: even a close failure at the destination must be retryable. */
    Entry writeTo(String expectedId, OutputStream out) throws IOException {
        if (out == null) throw new IOException("The document provider did not open the file");
        try (DataInputStream in = new DataInputStream(new FileInputStream(pending))) {
            Entry entry = header(in);
            if (!entry.id.equals(expectedId)) throw new IOException("The pending export changed");
            byte[] buffer = new byte[16 * 1024];
            int remaining = entry.size;
            while (remaining > 0) {
                int count = in.read(buffer, 0, Math.min(buffer.length, remaining));
                if (count < 0) throw new IOException("Truncated pending export");
                out.write(buffer, 0, count);
                remaining -= count;
            }
            out.flush();
            return entry;
        }
    }

    void discard(String expectedId) throws IOException {
        Entry entry = peek();
        if (entry == null) return;
        if (!entry.id.equals(expectedId)) throw new IOException("The pending export changed");
        if (!pending.delete()) throw new IOException("Cannot remove the pending export");
    }

    /** Explicit recovery action; never discards a valid pending export. */
    void discardDamaged() throws IOException {
        try {
            if (peek() != null) throw new IllegalStateException("Pending export is valid");
        } catch (IOException damaged) {
            if (!pending.delete()) throw new IOException("Cannot remove the damaged export", damaged);
        }
    }
}
