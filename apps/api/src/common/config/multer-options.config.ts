import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as memoryStorage from 'multer';

export const traceUploadMulterOptions: MulterOptions = {
  storage: memoryStorage.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, callback) => {
    const allowedExtensions = /\.(zip|gz|tar|png|jpg|jpeg|json|trace)$/i;
    const isAllowedExt = allowedExtensions.test(file.originalname);

    if (isAllowedExt) {
      return callback(null, true);
    }

    return callback(
      new BadRequestException(
        `File extension not supported for file: ${file.originalname}. Allowed extensions: .zip, .tar, .gz, .png, .jpg, .jpeg, .json, .trace`,
      ),
      false,
    );
  },
};
