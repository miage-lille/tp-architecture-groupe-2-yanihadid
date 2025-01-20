import { request } from 'http';
import { Email, IMailer } from 'src/core/ports/mailer.interface';
import { Executable } from 'src/shared/executable';
import { User } from 'src/users/entities/user.entity';
import { IUserRepository } from 'src/users/ports/user-repository.interface';
import { IParticipationRepository } from 'src/webinars/ports/participation-repository.interface';
import { IWebinarRepository } from 'src/webinars/ports/webinar-repository.interface';
import { Participation } from '../entities/participation.entity';

type Request = {
  webinarId: string;
  user: User;
};
type Response = void;

export class BookSeat implements Executable<Request, Response> {
  constructor(
    private readonly participationRepository: IParticipationRepository,
    private readonly userRepository: IUserRepository,
    private readonly webinarRepository: IWebinarRepository,
    private readonly mailer: IMailer,
  ) {}

  async execute({ webinarId, user }: Request): Promise<Response> {

    const webinar = await this.webinarRepository.findById(webinarId);

    if (!webinar) {
      throw new Error('Webinar introuvable');
    }

    const webinarParticipations = await this.participationRepository.findByWebinarId(webinarId);

    const alreadyRegistered = webinarParticipations.some(
      (participation) => participation.props.userId === user.props.id,
    );

    if (alreadyRegistered) {
      throw new Error('L’utilisateur est déjà inscrit à ce webinar');
    }

    if (webinar.hasNotEnoughSeats()) {
      throw new Error('Le webinar est complet');
    }

    const participation = new Participation({
      userId: user.props.id,
      webinarId,
    });

    await this.participationRepository.save(participation);

   
    webinar.addUser();
    await this.webinarRepository.create(webinar);

 
    const organizer = await this.userRepository.findById(webinar.props.organizerId);

    if (!organizer) {
      throw new Error('Organisateur introuvable');
    }

    const email: Email = {
      to: organizer.props.email,
      subject: 'Nouvelle inscription au webinar',
      body: `Bonjour,\nUn nouvel utilisateur s'est inscrit à votre webinar.`,
    };

    await this.mailer.send(email);

    return;
  }
}
