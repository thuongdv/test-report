import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseJsonPipe implements PipeTransform<string | object, object> {
  transform(value: string | object, metadata: ArgumentMetadata): object {
    if (!value) {
      throw new BadRequestException(
        `Payload for field '${metadata.data ?? 'payload'}' is required`,
      );
    }

    if (typeof value === 'object') {
      return value;
    }

    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new BadRequestException('Parsed payload must be an object');
        }
        return parsed;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          'Invalid JSON string provided in payload',
        );
      }
    }

    throw new BadRequestException('Payload must be a JSON string or object');
  }
}
