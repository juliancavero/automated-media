import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Pregunta, PreguntaDocument } from './schemas/pregunta.schema';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';

@Injectable()
export class PreguntaService {
  constructor(
    @InjectModel(Pregunta.name)
    private readonly preguntaModel: Model<PreguntaDocument>,
  ) {}

  async create(createPreguntaDto: CreatePreguntaDto): Promise<Pregunta> {
    const createdPregunta = new this.preguntaModel(createPreguntaDto);
    return createdPregunta.save();
  }

  async findAll(): Promise<Pregunta[]> {
    return this.preguntaModel.find().exec();
  }

  async findOne(id: string): Promise<Pregunta> {
    const pregunta = await this.preguntaModel.findById(id).exec();
    if (!pregunta) {
      throw new NotFoundException(`Pregunta con ID ${id} no encontrada`);
    }
    return pregunta;
  }

  async update(
    id: string,
    updatePreguntaDto: UpdatePreguntaDto,
  ): Promise<Pregunta> {
    const updatedPregunta = await this.preguntaModel
      .findByIdAndUpdate(id, updatePreguntaDto, { new: true })
      .exec();

    if (!updatedPregunta) {
      throw new NotFoundException(`Pregunta con ID ${id} no encontrada`);
    }

    return updatedPregunta;
  }

  async remove(id: string): Promise<void> {
    const result = await this.preguntaModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Pregunta con ID ${id} no encontrada`);
    }
  }
}
