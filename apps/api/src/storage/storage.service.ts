import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StoredAttachmentMeta } from '../runs/dto/ingest-run.dto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'traces');

  constructor() {
    this.ensureUploadDirExists();
  }

  private ensureUploadDirExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadDir}`);
    }
  }

  async saveTraceFile(
    file: Express.Multer.File,
  ): Promise<StoredAttachmentMeta> {
    this.ensureUploadDirExists();

    const fileExt = path.extname(file.originalname) || '.zip';
    const uniqueFilename = `${Date.now()}-${crypto.randomUUID()}${fileExt}`;
    const destinationPath = path.join(this.uploadDir, uniqueFilename);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.rename(file.path, destinationPath);
    } else {
      throw new Error('Uploaded file contains no data buffer or path');
    }

    const relativePath = path.relative(process.cwd(), destinationPath);

    return {
      filename: uniqueFilename,
      originalname: file.originalname,
      path: relativePath,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
