import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateFeedbackDto {
  @IsString({ message: 'El comentario debe ser texto' })
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  comment: string;

  @IsString({ message: 'El nombre del autor debe ser texto' })
  @IsOptional()
  customerName?: string; // Opcional, por si quieres mostrar quién lo escribió
}
